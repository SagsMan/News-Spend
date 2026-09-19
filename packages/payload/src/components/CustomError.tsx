import type React from "react";

type Props = {
  message: string;
  showError?: boolean;
};

export const CustomError: React.FC<Props> = (props) => {
  const { message, showError } = props;

  if (showError) {
    return <p style={{ color: "red" }}>{message}</p>;
  }
  return null;
};
