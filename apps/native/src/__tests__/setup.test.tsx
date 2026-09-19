import { render, screen } from "@testing-library/react-native";
import { Text, View } from "react-native";

describe("RN testing setup", () => {
  it("renders basic RN components", () => {
    render(
      <View>
        <Text>Hello from RN</Text>
      </View>
    );

    expect(screen.getByText("Hello from RN")).toBeTruthy();
  });
});
