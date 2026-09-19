import { fireEvent, render, screen } from "@testing-library/react-native";
import ForgotPassword from "../forgot-password";

const mockMutate = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: jest.fn(() => ({
    goBack: mockGoBack,
    replace: mockReplace,
    navigate: jest.fn(),
  })),
  useRoute: jest.fn(() => ({ params: {} })),
}));

jest.mock("../../hooks/useForgotPassword", () => ({
  __esModule: true,
  default: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

describe("ForgotPassword screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the heading and description", () => {
    render(<ForgotPassword />);

    expect(screen.getByText("Forgot Password")).toBeTruthy();
    expect(
      screen.getByText(
        "Don't worry! It occurs. Please enter the email address linked with your account."
      )
    ).toBeTruthy();
  });

  it("renders an email input and submit button", () => {
    render(<ForgotPassword />);

    expect(screen.getByPlaceholderText("example@email.com")).toBeTruthy();
    expect(screen.getByText("Send Code")).toBeTruthy();
  });

  it("allows typing an email into the input", () => {
    render(<ForgotPassword />);

    const input = screen.getByPlaceholderText("example@email.com");
    fireEvent.changeText(input, "test@example.com");

    expect(screen.getByPlaceholderText("example@email.com").props.value).toBe(
      "test@example.com"
    );
  });
});
