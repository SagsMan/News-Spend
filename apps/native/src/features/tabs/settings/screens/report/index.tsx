import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigation } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";
import { File as ExpoFile } from "expo-file-system";
import { Checkbox } from "heroui-native/checkbox";
import { ControlField } from "heroui-native/control-field";
import { FieldError } from "heroui-native/field-error";
import { Label } from "heroui-native/label";
import { LinkButton } from "heroui-native/link-button";
import { Spinner } from "heroui-native/spinner";
import { useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { z } from "zod";
import { Button } from "#/components/heroui/button";
import { Screen } from "#/components/heroui/screen";
import { FormSelectField } from "#/components/heroui/select";
import { StandardItem } from "#/components/heroui/select-item";
import { Text } from "#/components/heroui/text";
import FormTextInput from "#/components/heroui/text-input";
import { toast } from "#/components/heroui/toast";
import { openapi } from "#/lib/orpc";
import ReportFileSheet from "./components/report-file-sheet";

const schema = z.object({
  reportType: z.object(
    {
      label: z.string(),
      value: z.enum(["shortMessage", "video", "picture"]),
    },
    "Choose a report type"
  ),
  title: z
    .string("Title is required")
    .trim()
    .min(12, "Title must be at least 10 characters"),
  description: z
    .string("Description is required")
    .min(20, "Description must be at least 20 characters"),
  name: z
    .string("Your name is required")
    .trim()
    .min(4, "Your name must be at least 6 characters"),
  files: z
    .array(
      z.object({
        uri: z.string(),
        name: z.string().optional(),
        type: z.string().optional(),
        size: z.number().optional(),
      })
    )
    .refine((files) => files.length > 0, "You must upload at least one file")
    .refine((files) => {
      const totalSize = files.reduce(
        (prev, curr) => prev + (curr.size ?? 0),
        0
      );
      return totalSize < 30_000_000;
    }, "Total size of files must be less than 30MB"),
  agree: z
    .boolean("You must agree to the terms of use")
    .refine((agree) => agree === true, "You must agree to the terms of use"),
});

export type ReportInput = z.infer<typeof schema>;

function Report() {
  const createReportMutation = useMutation(
    openapi.report.create.mutationOptions()
  );
  const [open, setOpen] = useState(false);
  const navigation = useNavigation();

  const formMethods = useForm<ReportInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      reportType: { label: "Short Message", value: "shortMessage" },
      files: [],
    },
  });

  const onSubmit = (data: ReportInput) => {
    try {
      const fd = new FormData();
      fd.append("name", data.name);
      fd.append("title", data.title);
      fd.append("description", data.description);
      fd.append("reportType", data.reportType.value);
      for (const file of data.files) {
        fd.append("files[]", new ExpoFile(file.uri));
      }
      createReportMutation.mutate(fd, {
        onSuccess: () => {
          toast("Thank you for your report!", {
            description:
              "Your news report has been submitted and will be reviewed shortly.",
          });
          formMethods.reset();
        },
        onError: (err) => {
          console.log(err);
          toast.error("Could not submit your report", {
            description:
              "Please check your connection and try again. If the problem persists, contact support.",
          });
        },
      });
    } catch (error) {
      console.log(error);
      toast.error("Error submitting report", {
        description: "Something went wrong",
      });
    }
  };
  return (
    <Screen className="bg-white" statusBarStyle="light">
      <KeyboardAwareScrollView contentContainerClassName="gap-4 px-2.5 pb-safe-2 pt-2">
        <FormProvider {...formMethods}>
          <View className="gap-4">
            <FormTextInput
              label="Your name"
              name="name"
              placeholder="Enter your name"
            />
            <FormTextInput
              label="News Title"
              name="title"
              placeholder="Enter title"
            />
            <FormTextInput
              label="News Description"
              multiline
              name="description"
              placeholder="Report description here"
            />

            <FormSelectField
              label="News Type"
              name="reportType"
              options={newsTypes}
              placeholder="Select news type"
              renderItem={(option, { isSelected }) => (
                <StandardItem isSelected={isSelected} label={option.label} />
              )}
            />

            <View className="gap-1">
              <Label gap="$1">Files</Label>
              <Controller
                control={formMethods.control}
                name="files"
                render={({ field: { onChange, value } }) => (
                  <ReportFileSheet
                    files={value}
                    open={open}
                    reportType={formMethods.watch("reportType")}
                    setFiles={onChange}
                    setOpen={setOpen}
                  />
                )}
              />
              {formMethods.formState.errors.files ? (
                <FieldError isInvalid>
                  {formMethods.formState.errors.files?.message}
                </FieldError>
              ) : null}
            </View>

            {/* agree to terms of use */}
            <Controller
              control={formMethods.control}
              name="agree"
              render={({
                field: { onChange, value, name },
                fieldState: { error, invalid },
              }) => (
                <ControlField
                  className="flex-col items-start"
                  isInvalid={invalid}
                  isSelected={value}
                  onSelectedChange={onChange}
                >
                  <View className="flex-row items-center gap-2">
                    <ControlField.Indicator>
                      <Checkbox className="mt-0.5 rounded-sm border border-field-border" />
                    </ControlField.Indicator>
                    <View className="flex-1 flex-row flex-wrap">
                      <Text className="">I agree to the </Text>
                      <LinkButton
                        onPress={() => navigation.navigate("TermsOfUse")}
                        size="sm"
                      >
                        <LinkButton.Label className="text-accent underline">
                          Terms of Use
                        </LinkButton.Label>
                      </LinkButton>
                    </View>
                  </View>

                  <FieldError isInvalid>{error?.message}</FieldError>
                </ControlField>
              )}
            />

            <Button
              isDisabled={createReportMutation.isPending}
              onPress={formMethods.handleSubmit(onSubmit)}
            >
              {createReportMutation.isPending && <Spinner />}
              <Button.Label>Submit</Button.Label>
            </Button>
          </View>
        </FormProvider>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

export default Report;

const newsTypes = [
  { label: "Short Message", value: "shortMessage" },
  { label: "Video", value: "video" },
  { label: "Picture", value: "picture" },
];
