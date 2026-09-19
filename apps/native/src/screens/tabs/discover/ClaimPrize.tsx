import { isInferableError } from "@orpc/client";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card } from "heroui-native/card";
import { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";

import { ScreenHeader } from "#/components";
import { Button } from "#/components/heroui/button";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import FormTextInput from "#/components/heroui/text-input";
import { toast } from "#/components/heroui/toast";
import { orpc } from "#/lib/orpc";
import { queryClient } from "#/lib/tanstackQuery";

/**
 * Claim one prize.
 *
 * One screen rather than several, because what a winner has to supply is
 * decided by the prize, not by a different flow: the API says which of a phone
 * number, an address or nothing at all this prize needs, and the form below is
 * that answer rendered. Splitting it per prize type would mean four screens
 * that differ by two fields.
 */
type ClaimForm = {
  phoneNumber: string;
  recipientName: string;
  shippingAddress: string;
};

const ClaimPrize = () => {
  const navigation = useNavigation("ClaimPrize");
  const route = useRoute("ClaimPrize");
  const winnerId = route.params?.winnerId;

  const form = useForm<ClaimForm>({
    defaultValues: { phoneNumber: "", recipientName: "", shippingAddress: "" },
    mode: "onChange",
  });

  /**
   * Fetched by id rather than found in the list. Once the list is paged, a
   * prize far enough back in someone's history simply is not in the page the
   * app happens to be holding.
   */
  const { data: prize, isPending } = useQuery(
    orpc.giveaway.winning.queryOptions({
      input: { winnerId: winnerId ?? "" },
      enabled: Boolean(winnerId),
    })
  );

  /**
   * Seed the form with what is already on record when correcting details.
   *
   * `values` rather than `defaultValues`: the prize arrives after the form is
   * created, and defaultValues are only read on the first render. Guarded on
   * the form being untouched so it cannot overwrite what someone is typing.
   */
  useEffect(() => {
    if (prize?.canEditDetails && !form.formState.isDirty) {
      form.reset({
        phoneNumber: prize.sentTo ?? "",
        recipientName: prize.recipientName ?? "",
        shippingAddress: prize.shippingAddress ?? "",
      });
    }
  }, [prize, form]);

  const claim = useMutation(
    orpc.giveaway.claimPrize.mutationOptions({
      onSuccess: (result) => {
        toast.success("Prize claimed!", { description: result.message });
        queryClient.invalidateQueries({
          queryKey: orpc.giveaway.actionable.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.giveaway.history.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.giveaway.winning.key(),
        });

        if (result.pointsCredited > 0) {
          queryClient.invalidateQueries(
            orpc.activity.totalPoints.queryOptions()
          );
        }

        if (result.awaitingVerification) {
          /**
           * The Didit-backed flow. The older `VerifyIdentity` screen this
           * route once pointed at photographed a passport and uploaded it
           * into our own storage — exactly what moving to Didit was meant to
           * stop — and was removed with the legacy lottery.
           */
          navigation.navigate("IdentityVerification");
          return;
        }

        navigation.goBack();
      },
      onError: (error) => {
        // The window may have closed while this screen was open (a new
        // giveaway starting is enough to do it), so the list has to be
        // refetched rather than left showing a claim button that cannot work.
        if (isInferableError(error) && error.code === "CONFLICT") {
          queryClient.invalidateQueries({
            queryKey: orpc.giveaway.actionable.key(),
          });
          queryClient.invalidateQueries({
            queryKey: orpc.giveaway.history.key(),
          });
          queryClient.invalidateQueries({
            queryKey: orpc.giveaway.winning.key(),
          });
        }
        toast.error(
          isInferableError(error)
            ? error.message
            : "Could not claim this prize."
        );
      },
    })
  );

  /**
   * Correcting details already given, rather than claiming.
   *
   * Same form, because the questions are identical; what changes is which
   * procedure answers them and what the screen calls itself. A separate screen
   * would be the same four fields with a different title.
   */
  const editing = Boolean(prize?.canEditDetails);
  const title = editing ? "Update Details" : "Claim Prize";

  const edit = useMutation(
    orpc.giveaway.updateClaimDetails.mutationOptions({
      onSuccess: (result) => {
        toast.success("Details updated", { description: result.message });
        queryClient.invalidateQueries({
          queryKey: orpc.giveaway.actionable.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.giveaway.winning.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.giveaway.prizeDetails.key(),
        });
        navigation.goBack();
      },
      onError: (error) => {
        toast.error(
          isInferableError(error)
            ? error.message
            : "Could not update these details."
        );
      },
    })
  );

  if (isPending) {
    return (
      <Screen>
        <ScreenHeader title="Claim Prize" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (!prize) {
    return (
      <Screen>
        <ScreenHeader title="Claim Prize" />
        <View className="flex-1 items-center justify-center gap-2 px-8">
          <Text className="text-center font-semibold text-lg">
            Prize not found
          </Text>
          <Text className="text-center text-subtle-text">
            It may have already been claimed or its claim window has closed.
          </Text>
        </View>
      </Screen>
    );
  }

  const busy = claim.isPending || edit.isPending;
  const values = form.watch();
  const missingDetails =
    (prize.needs.phone && values.phoneNumber.trim().length < 7) ||
    (prize.needs.address &&
      (values.shippingAddress.trim().length < 10 ||
        values.recipientName.trim().length < 2));

  const submit = form.handleSubmit((data) => {
    const phoneNumber = prize.needs.phone ? data.phoneNumber.trim() : undefined;

    const send = () =>
      (editing ? edit : claim).mutate({
        winnerId: prize.id,
        phoneNumber,
        recipientName: prize.needs.address
          ? data.recipientName.trim()
          : undefined,
        shippingAddress: prize.needs.address
          ? data.shippingAddress.trim()
          : undefined,
      });

    /**
     * Read the number back before sending anything to it.
     *
     * Airtime and data go straight to whatever number is typed here, and the
     * provider has no idea it was meant for someone else. A transposed digit
     * tops up a stranger, and there is no way to pull it back. A claim can
     * also only be made once, so the mistake is not recoverable in the app
     * either.
     *
     * Only for the phone, deliberately. A wrong postal address is fixable by
     * whoever ships the item; a wrong phone number is not fixable by anyone.
     */
    if (!phoneNumber) {
      send();
      return;
    }

    Alert.alert(
      "Send to this number?",
      editing
        ? `${prize.prizeName} will be sent to ${phoneNumber} instead. Check it carefully, because once it sends, it cannot be pulled back.`
        : `${prize.prizeName} will be sent to ${phoneNumber}. This cannot be undone, and a prize can only be claimed once.`,
      [
        { text: "Check again", style: "cancel" },
        { text: "Yes, send it", onPress: send },
      ]
    );
  });

  return (
    <Screen>
      <ScreenHeader title={title} />

      <ScrollView contentContainerClassName="gap-4 px-4 pb-8">
        <Card>
          <Card.Body className="items-center gap-1 py-6">
            <Text className="text-sm text-subtle-text">
              {editing ? "Updating details for" : "You won"}
            </Text>
            <Text className="text-center font-extrabold text-xl">
              {prize.prizeName}
            </Text>
          </Card.Body>
        </Card>

        {!(prize.claimable || editing) && (
          <Text className="text-center text-subtle-text">
            {prize.closedMessage ?? "This prize can no longer be claimed."}
          </Text>
        )}

        {(prize.claimable || editing) && (
          <FormProvider {...form}>
            {prize.needs.phone && (
              <View className="gap-1">
                <FormTextInput
                  description="We'll send it straight to this number, so check it carefully. Nigerian numbers only for now."
                  keyboardType="phone-pad"
                  label="Phone number"
                  name="phoneNumber"
                  placeholder="080..."
                />
              </View>
            )}

            {prize.needs.address && (
              <>
                <FormTextInput
                  autoCapitalize="words"
                  label="Recipient name"
                  name="recipientName"
                  placeholder="Who should the courier ask for?"
                />
                <FormTextInput
                  description="We can only deliver within Nigeria for now."
                  isMultiline
                  label="Delivery address"
                  name="shippingAddress"
                  placeholder="Street, area, city, state"
                />
              </>
            )}

            {(prize.needs.phone || prize.needs.address) && (
              <Text className="text-sm text-subtle-text">
                Made a mistake? You can change these from the prize screen until
                it's on its way.
              </Text>
            )}

            {prize.needs.verification && (
              <Text className="text-sm text-subtle-text">
                This prize needs an identity check before it can be sent.
                Claiming now secures it. You can verify whenever you're ready.
              </Text>
            )}

            {!(prize.needs.phone || prize.needs.address) && (
              <Text className="text-center text-subtle-text">
                Nothing else needed. Tap below and it's yours.
              </Text>
            )}

            <Button isDisabled={missingDetails || busy} onPress={submit}>
              <Button.Label>
                {busy
                  ? editing
                    ? "Saving…"
                    : "Claiming…"
                  : editing
                    ? "Save changes"
                    : "Claim prize"}
              </Button.Label>
              {busy && (
                <ActivityIndicator className="ml-2" color="#fff" size="small" />
              )}
            </Button>
          </FormProvider>
        )}
      </ScrollView>
    </Screen>
  );
};

export default ClaimPrize;
