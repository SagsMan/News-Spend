import type { RefObject } from "react";
import { useEffect } from "react";
import type { TextInput } from "react-native";
import { KeyboardEvents } from "react-native-keyboard-controller";
import { isRefObject } from "#/utils/comment-utils";

/**
 * Runs `onDismiss` whenever the keyboard hides.
 * Also blurs the provided inputRef so the cursor disappears cleanly.
 */
export function useKeyboardDismiss(
  inputRef:
    | RefObject<TextInput | null>
    | ((instance: TextInput | null) => void)
    | undefined,
  onDismiss: () => void
) {
  useEffect(() => {
    const sub = KeyboardEvents.addListener("keyboardDidHide", () => {
      if (isRefObject(inputRef) && inputRef.current) {
        inputRef.current.blur();
      }
      onDismiss();
    });
    return () => sub.remove();
  }, [onDismiss, inputRef]);
}
