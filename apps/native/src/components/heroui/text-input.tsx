import { Description } from "heroui-native/description";
import { FieldError } from "heroui-native/field-error";
import { Input } from "heroui-native/input";
import { Label } from "heroui-native/label";
import { TextArea } from "heroui-native/text-area";
import { TextField } from "heroui-native/text-field";
import { cn } from "heroui-native/utils";
import { EyeIcon, EyeSlashIcon } from "#/lib/icons";
import { useState } from "react";
import {
  Controller,
  type RegisterOptions,
  useFormContext,
} from "react-hook-form";
import { Pressable, View } from "react-native";
import { Icon } from "./icon";

type TextInputProps = {
  isMultiline?: boolean;
  isPassword?: boolean;
  name: string;
  description?: string;
  placeholder: string;
  rules?: RegisterOptions;
  label?: string;
} & React.ComponentPropsWithoutRef<typeof Input>;

export function FormTextInput({
  name,
  placeholder,
  isPassword = false,
  isMultiline = false,
  label,
  description,
  ...rest
}: TextInputProps) {
  const { control } = useFormContext();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState }) => (
        <TextField isInvalid={fieldState.invalid}>
          <Label>{label}</Label>

          {isMultiline ? (
            <TextArea
              autoCapitalize="sentences"
              className="w-full rounded-lg px-4 android:shadow-none"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder={placeholder}
              value={value}
              {...rest}
            />
          ) : (
            <View className="w-full flex-row items-center">
              <Input
                autoCapitalize="none"
                className={cn(
                  "flex-1 rounded-lg px-4 android:shadow-none",
                  isPassword && "pr-10"
                )}
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder={placeholder}
                secureTextEntry={isPassword && !showPassword}
                value={value}
                {...rest}
              />
              {isPassword && (
                <Pressable
                  className="absolute right-3"
                  hitSlop={8}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <Icon
                      className="text-muted"
                      name={EyeSlashIcon}
                      size={20}
                    />
                  ) : (
                    <Icon className="text-muted" name={EyeIcon} size={20} />
                  )}
                </Pressable>
              )}
            </View>
          )}

          {description && fieldState.invalid && (
            <Description>{description}</Description>
          )}
          {fieldState.error && (
            <FieldError>{fieldState.error.message}</FieldError>
          )}
        </TextField>
      )}
    />
  );
}

export default FormTextInput;
