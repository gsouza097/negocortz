import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ contentStyle: { backgroundColor: "#101116" }, headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="portal" />
      </Stack>
    </>
  );
}
