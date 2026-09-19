import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { BottomSheet } from "heroui-native/bottom-sheet";
import { ListGroup } from "heroui-native/list-group";
import { Separator } from "heroui-native/separator";
import { FileArrowUpIcon, XIcon } from "#/lib/icons";
import { Alert, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "#/components/heroui/text";

type ReportType = "shortMessage" | "picture" | "video";

type ReportFileSheetProps = {
  reportType: ReportType | { value: ReportType };
  open: boolean;
  setOpen: (open: boolean) => void;
  files: (
    | ImagePicker.ImagePickerAsset
    | {
        uri: string;
        name?: string;
        type?: string;
        mimeType?: string;
        size?: number;
        fileName?: string;
      }
  )[];
  setFiles: (files: ReportFileSheetProps["files"]) => void;
};

const getFileName = (uri: string) => uri.split("/").pop();

function formatSize(bytes: number) {
  const kb = bytes / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

export default function ReportFileSheet({
  reportType,
  open,
  setOpen,
  files,
  setFiles,
}: ReportFileSheetProps) {
  const insets = useSafeAreaInsets();
  const reportTypeValue =
    typeof reportType === "string" ? reportType : reportType.value;

  const accept = (() => {
    switch (reportTypeValue) {
      case "shortMessage":
        return ["application/msword", "application/pdf", "image/*"];
      case "picture":
        return ["image/*"];
      case "video":
        return ["video/*"];
      default:
        return [];
    }
  })();

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: accept,
        copyToCacheDirectory: true,
        multiple: true,
      });

      const totalSize = result?.assets?.reduce(
        (prev, curr) => prev + (curr.size ?? 0),
        0
      );
      if (totalSize && totalSize > 30_000_000) {
        Alert.alert(
          "File size limit exceeded",
          "Please select files with a total size of less than 30MB.",
          [{ text: "OK" }]
        );
        return;
      }

      if (result.canceled) {
        Alert.alert("You did not select any file.");
      } else {
        setFiles([
          ...files,
          {
            uri: result.assets[0].uri,
            name: result.assets[0].name ?? "",
            type: result.assets[0].mimeType ?? "",
            size: result.assets[0].size ?? 0,
          },
        ]);
      }

      setOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const pickImageOrVideoAsync = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: reportTypeValue === "picture" ? ["images"] : ["videos"],
      quality: 1,
      allowsMultipleSelection: true,
    });

    if (result.canceled) {
      Alert.alert(
        `You did not select any ${reportTypeValue === "picture" ? "image" : "video"}.`
      );
    } else {
      setFiles([
        ...files,
        {
          uri: result.assets[0].uri,
          name: result.assets[0].fileName ?? "",
          type: result.assets[0].mimeType ?? "",
          size: result.assets[0].fileSize ?? 0,
        },
      ]);
    }

    setOpen(false);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
    });

    if (result.canceled) {
      Alert.alert('You did not select any "image".');
    } else {
      setFiles([
        ...files,
        {
          uri: result.assets[0].uri,
          name: result.assets[0].fileName ?? "",
          type: result.assets[0].mimeType ?? "",
          size: result.assets[0].fileSize ?? 0,
        },
      ]);
    }

    setOpen(false);
  };

  const pickVideo = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["videos"],
    });

    if (result.canceled) {
      Alert.alert('You did not select any "video".');
    } else {
      setFiles([
        ...files,
        {
          uri: result.assets[0].uri,
          name: result.assets[0].fileName ?? "",
          type: result.assets[0].mimeType ?? "",
          size: result.assets[0].fileSize ?? 0,
        },
      ]);
    }

    setOpen(false);
  };

  return (
    <>
      <Pressable
        className="rounded-xl border-2 border-gray-300 border-dashed p-4"
        onPress={() => setOpen(true)}
      >
        <View className="flex-row items-center justify-between">
          <Text>Click here to upload file</Text>
          <FileArrowUpIcon size={20} />
        </View>
        <Text className="mt-1 text-center" variant="caption">
          {(() => {
            switch (reportTypeValue) {
              case "picture":
                return "Image";
              case "video":
                return "Video";
              case "shortMessage":
                return "PDF, DOC, or image";
              default:
                return "";
            }
          })()} format up to 30MB
        </Text>

        {files.length > 0 && (
          <View className="mt-4 w-full self-center rounded-xl border border-gray-200">
            {files.map((file, i) => {
              const f = file as {
                name?: string;
                fileName?: string;
                size?: number;
                fileSize?: number;
              };
              const fileName = f.name ?? f.fileName ?? getFileName(file.uri);
              const rawSize = f.size ?? f.fileSize ?? 1000;
              const displaySize = formatSize(rawSize);

              return (
                <View key={i}>
                  {i > 0 && <Separator className="mx-4" />}
                  <View className="flex-row items-center gap-2 px-4 py-3">
                    <Text
                      className="flex-1 text-gray-500 text-sm"
                      ellipsizeMode="middle"
                      numberOfLines={1}
                    >
                      {fileName}
                    </Text>
                    <Text className="w-16 text-right text-gray-500 text-sm">
                      {displaySize}
                    </Text>
                    <Pressable
                      hitSlop={8}
                      onPress={() =>
                        setFiles(files.filter((_, index) => index !== i))
                      }
                    >
                      <XIcon size={18} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Pressable>

      <BottomSheet isOpen={open} onOpenChange={setOpen}>
        {/* disableFullWindowOverlay in dev: default FullWindowOverlay renders
        in a separate native window and blocks the RN element inspector. */}
        <BottomSheet.Portal disableFullWindowOverlay={__DEV__}>
          <BottomSheet.Overlay />
          <BottomSheet.Content style={{ paddingBottom: insets.bottom }}>
            <ListGroup variant="transparent">
              <Text className="px-4 pb-3" variant="subtitle">
                Upload file
              </Text>
              <Separator />
              <ListGroup.Item
                onPress={
                  reportTypeValue === "shortMessage"
                    ? pickDocument
                    : pickImageOrVideoAsync
                }
              >
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>
                    Select file from your device
                  </ListGroup.ItemTitle>
                </ListGroup.ItemContent>
              </ListGroup.Item>
              {reportTypeValue === "video" ? (
                <>
                  <Separator className="mx-4" />
                  <ListGroup.Item onPress={pickVideo}>
                    <ListGroup.ItemContent>
                      <ListGroup.ItemTitle>
                        Record video from camera
                      </ListGroup.ItemTitle>
                    </ListGroup.ItemContent>
                  </ListGroup.Item>
                </>
              ) : null}
              {reportTypeValue === "picture" ? (
                <>
                  <Separator className="mx-4" />
                  <ListGroup.Item onPress={pickImage}>
                    <ListGroup.ItemContent>
                      <ListGroup.ItemTitle>
                        Take a picture from the app
                      </ListGroup.ItemTitle>
                    </ListGroup.ItemContent>
                  </ListGroup.Item>
                </>
              ) : null}
            </ListGroup>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </>
  );
}
