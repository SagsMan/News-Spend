export const formatDistance = (token: string | string[], count: any) =>
  token.includes("Hours")
    ? `${count}h`
    : token.includes("Months")
      ? `${count} months ago`
      : token.includes("Minutes")
        ? `${count}m`
        : token.includes("Seconds")
          ? `${count}s`
          : token.includes("Years")
            ? `${count}y`
            : token.includes("Weeks")
              ? `${count}w`
              : token.includes("Days")
                ? `${count}d`
                : "";
