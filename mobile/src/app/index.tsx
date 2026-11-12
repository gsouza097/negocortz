import { Image } from "expo-image";
import { Link, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { continuationPath, SITE_ORIGIN } from "../portal";

const logo = require("../../assets/icon-nego-cortz.png");

export default function HomeScreen() {
  const { continuar } = useLocalSearchParams<{ continuar?: string }>();
  const continuation = continuationPath(continuar);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image source={logo} accessibilityLabel="Logo da Nego Cortz" style={styles.logo} contentFit="contain" />
          <Text style={styles.eyebrow}>BARBEARIA</Text>
          <Text accessibilityRole="header" style={styles.heading}>Nego Cortz</Text>
          <Text style={styles.body}>Escolha seu barbeiro e reserve o próximo corte.</Text>
        </View>

        <View style={styles.actions}>
          {continuation && (
            <Link href={{ pathname: "/portal", params: { destino: "continuar", continuar: continuation } }} asChild>
              <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
                <Text style={styles.buttonText}>Continuar de onde parei</Text>
              </Pressable>
            </Link>
          )}
          <Link href={{ pathname: "/portal", params: { destino: "agenda" } }} asChild>
            <Pressable style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}>
              <Text style={styles.buttonText}>Agendar meu horário</Text>
            </Pressable>
          </Link>
          <Link href={{ pathname: "/portal", params: { destino: "reservas" } }} asChild>
            <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
              <Text style={styles.buttonText}>Minhas reservas</Text>
            </Pressable>
          </Link>
          <Link href={{ pathname: "/portal", params: { destino: "painel" } }} asChild>
            <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
              <Text style={styles.buttonText}>Painel da equipe</Text>
            </Pressable>
          </Link>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.share, pressed && styles.pressed]}
            onPress={() => { void Share.share({ message: `Agende na Barbearia Nego Cortz: ${SITE_ORIGIN}` }).catch(() => {}); }}
          >
            <Text style={styles.shareText}>Compartilhar barbearia</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#101116" },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 24, justifyContent: "center" },
  hero: { width: "100%", maxWidth: 440, alignSelf: "center", alignItems: "center", marginBottom: 26 },
  logo: { width: 152, height: 152, borderRadius: 26, marginBottom: 22 },
  eyebrow: { color: "#a8cbff", fontSize: 12, fontWeight: "800", letterSpacing: 4 },
  heading: { color: "#fff", fontSize: 43, fontWeight: "900", textAlign: "center", marginTop: 3 },
  body: { color: "#d3d7e0", fontSize: 16, textAlign: "center", marginTop: 8 },
  actions: { width: "100%", maxWidth: 440, alignSelf: "center", gap: 10 },
  button: { minHeight: 52, justifyContent: "center", alignItems: "center", borderRadius: 16, borderWidth: 1, borderColor: "#505663", padding: 12 },
  primary: { backgroundColor: "#c91420", borderColor: "#c91420" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700", textAlign: "center" },
  pressed: { opacity: 0.72 },
  share: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  shareText: { color: "#a8cbff", fontWeight: "600", textAlign: "center" },
});
