import { useNavigation } from "@react-navigation/native";
import { useDislikeNews, useLikeNews } from "#/hooks/news";
import { authState } from "#/state/auth";

export function useArticleActions(
  data: { id: string; slug: string } | undefined,
  onLike?: () => void,
  onDislike?: () => void
) {
  const navigation = useNavigation("News");
  const likeMutation = useLikeNews();
  const dislikeMutation = useDislikeNews();

  const requireAuth = () => {
    if (!authState.user || authState.user.isAnonymous) {
      navigation.navigate("SignIn", { redirect: "News" });
      return false;
    }
    return true;
  };

  const handleLike = () => {
    if (!(requireAuth() && data)) {
      return;
    }
    onLike?.();
    likeMutation.mutate({
      newsId: data.id,
      userId: authState.user?.id,
      slug: data.slug,
    });
  };

  const handleDislike = () => {
    if (!(requireAuth() && data)) {
      return;
    }
    onDislike?.();
    dislikeMutation.mutate({
      newsId: data.id,
      userId: authState.user?.id,
      slug: data.slug,
    });
  };

  return { handleLike, handleDislike };
}
