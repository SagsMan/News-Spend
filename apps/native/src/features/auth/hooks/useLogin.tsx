import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "#/components/heroui/toast";
import { userQueryOptions } from "#/hooks/auth/useUser";
import { authClient } from "#/lib/authClient";
import { hydrateAuth } from "#/state/auth";

function useLogin() {
  const navigation = useNavigation();
  const route = useRoute("SignIn");
  const redirect = route.params?.redirect ?? false;
  const queryClient = useQueryClient();

  const login = async (data) =>
    await authClient.signIn.email({
      email: data.email,
      password: data.password,
    });

  return useMutation({
    mutationFn: login,
    onSuccess: ({ data, error }, variables) => {
      if (data) {
        toast("Sign In Successful", {
          description: "You signed in successfully",
        });

        hydrateAuth();

        queryClient.clear();
        queryClient.ensureQueryData(userQueryOptions);

        if (redirect) {
          navigation.goBack();
        } else {
          // navigation.navigate("Tab");
        }

        return;
      }

      if (error) {
        if (error.status === 401) {
          return toast.error("Wrong Credentials", {
            description: "Invalid email or password",
          });
        }
        if (error.status === 403 && error.code === "EMAIL_NOT_VERIFIED") {
          toast("Verify your email", {
            description: "Please verify your email address to continue",
          });
          navigation.navigate("Verification", {
            email: variables.email,
            otpSent: false,
          });
          return;
        }
        toast.error("Something went wrong");
      }
      // authState.token = data.token;
      // authState.exp = data.exp;
    },
    onError: (_error) => {
      toast.error("An error occurred", {
        description: "Login failed",
      });
    },
  });
}

export default useLogin;
