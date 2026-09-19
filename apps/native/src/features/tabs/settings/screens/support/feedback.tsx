import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Spinner } from "heroui-native/spinner";
import { StarIcon } from "#/lib/icons";
import { FormProvider, useForm } from "react-hook-form";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSnapshot } from "valtio";
import { z } from "zod";
import { Button } from "#/components/heroui/button";
import { Icon } from "#/components/heroui/icon";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import FormTextInput from "#/components/heroui/text-input";
import { toast } from "#/components/heroui/toast";
import { orpc } from "#/lib/orpc";
import { authState } from "#/state/auth";

const formSchema = z
  .object({
    name: z.string().min(3, "Name must be at least 3 characters"),
    email: z.string().email("Enter a valid email"),
    message: z.string().min(30, "Message must be at least 30 characters"),
    rating: z
      .number({
        error: "Choose a rating",
      })
      .min(1, {
        message: "Choose a rating",
      })
      .max(5)
      .optional(),
  })
  .strict();

const Feedback = () => {
  const { user } = useSnapshot(authState);

  const formMethods = useForm<z.infer<typeof formSchema>>({
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      message: "",
      rating: 0,
    },
    resolver: zodResolver(formSchema),
  });

  const { setValue, handleSubmit, watch, formState } = formMethods;

  const mutation = useMutation(
    orpc.feedback.create.mutationOptions({
      onSuccess: () => {
        toast.success("Thank you for your feedback!", {
          description: "We'll get back to you shortly.",
        });
        formMethods.reset({
          name: user?.name ?? "",
          email: user?.email ?? "",
          message: "",
          rating: 0,
        });
      },
      onError: (err) => {
        toast.error("Error submitting feedback", {
          description: "Something went wrong",
        });
        console.log(err);
      },
    })
  );

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    mutation.mutate({
      type: "general" as const,
      ...data,
    });
  };

  const currentRating = watch("rating") ?? 0;

  return (
    <Screen safeAreaEdges={["bottom"]} statusBarStyle="light">
      <KeyboardAwareScrollView
        bottomOffset={100}
        contentContainerClassName="gap-6 px-5 pt-5 pb-12"
        showsVerticalScrollIndicator={false}
      >
        <Text className="font-semibold text-lg">
          We'd love to hear from you!
        </Text>

        <FormProvider {...formMethods}>
          <View className="gap-5">
            <FormTextInput label="Name" name="name" placeholder="Your name" />

            <FormTextInput
              label="Email"
              name="email"
              placeholder="Your email"
            />

            {/* Star rating */}
            <View className="gap-3">
              <Text className="font-semibold">
                How would you rate your experience?
              </Text>
              <View className="flex-row gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Icon
                    color={i < currentRating ? "#ffb300" : "#a1a1aa"}
                    key={i}
                    name={StarIcon}
                    onPress={() =>
                      setValue("rating", i + 1, { shouldValidate: true })
                    }
                    s
                    size={32}
                    weight={i < currentRating ? "fill" : "regular"}
                  />
                ))}
              </View>
              {formState.errors.rating && (
                <Text className="pl-2 text-red-500 text-sm">
                  {formState.errors.rating.message}
                </Text>
              )}
            </View>

            <FormTextInput
              label="What can we do better?"
              multiline
              name="message"
              placeholder="Type here..."
            />
          </View>
        </FormProvider>

        <Button
          isDisabled={mutation.isPending}
          onPress={handleSubmit(onSubmit)}
        >
          {mutation.isPending ? <Spinner /> : null}
          <Button.Label>Submit</Button.Label>
        </Button>
      </KeyboardAwareScrollView>
    </Screen>
  );
};

export default Feedback;
