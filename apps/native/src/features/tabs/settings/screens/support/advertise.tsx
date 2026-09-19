import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Spinner } from "heroui-native/spinner";
import { FormProvider, useForm } from "react-hook-form";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSnapshot } from "valtio";
import { z } from "zod";
import { Button } from "#/components/heroui/button";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import FormTextInput from "#/components/heroui/text-input";
import { toast } from "#/components/heroui/toast";
import { orpc } from "#/lib/orpc";
import { authState } from "#/state/auth";

const formSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  email: z.email("Enter a valid email"),
  message: z.string().min(30, "Message must be at least 30 characters"),
});

const Advertise = () => {
  const { user } = useSnapshot(authState);

  const formMethods = useForm<z.infer<typeof formSchema>>({
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      message: "",
    },
    resolver: zodResolver(formSchema),
  });

  const mutation = useMutation(
    orpc.feedback.create.mutationOptions({
      onSuccess: () => {
        toast.success("Thank you for your enquiry!", {
          description: "We'll get back to you shortly.",
        });
        formMethods.reset({
          name: user?.name ?? "",
          email: user?.email ?? "",
          message: "",
        });
      },
      onError: (err) => {
        toast.error("Failed to submit your advertisement enquiry", {
          description: "Please check your connection and try again.",
        });
        console.log(err);
      },
    })
  );

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    mutation.mutate({
      type: "advertisement" as const,
      ...data,
    });
  };

  return (
    <Screen safeAreaEdges={["bottom"]} statusBarStyle="light">
      <KeyboardAwareScrollView
        bottomOffset={100}
        contentContainerClassName="gap-6 px-5 pt-5 pb-12"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-base leading-relaxed">
          We're always looking for great partners to advertise with. Please
          provide us with the following information and we'll get back to you
          shortly.
        </Text>

        <FormProvider {...formMethods}>
          <View className="gap-5">
            <FormTextInput label="Name" name="name" placeholder="Your name" />

            <FormTextInput
              label="Email"
              name="email"
              placeholder="Your email"
            />

            <FormTextInput
              label="Message"
              multiline
              name="message"
              placeholder="Type here..."
            />
          </View>
        </FormProvider>

        <Button
          isDisabled={mutation.isPending}
          onPress={formMethods.handleSubmit(onSubmit)}
        >
          {mutation.isPending ? <Spinner /> : null}
          <Button.Label>Send</Button.Label>
        </Button>
      </KeyboardAwareScrollView>
    </Screen>
  );
};

export default Advertise;
