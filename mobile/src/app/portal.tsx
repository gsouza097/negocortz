import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { classifyUrl, loginLanding, portalUrl, SITE_ORIGIN } from "../portal";

export default function PortalScreen() {
  const { destino, continuar } = useLocalSearchParams<{ destino?: string; continuar?: string }>();
  const router = useRouter();
  const web = useRef<WebView<unknown>>(null);
  const canGoBack = useRef(false);
  const loginHandled = useRef(false);
  const [popupUrl, setPopupUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const sourceUrl = popupUrl ?? portalUrl(destino, continuar);

  const returnHomeAfterLogin = (url: string) => {
    const landing = loginLanding(url);
    if (!landing || loginHandled.current) return;
    loginHandled.current = true;
    router.dismissTo({ pathname: "/", params: { continuar: landing.continuation ?? "" } });
  };

  const goBack = useCallback(() => {
    if (canGoBack.current && !failed) web.current?.goBack();
    else if (router.canGoBack()) router.back();
    else router.replace("/");
    return true;
  }, [failed, router]);

  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", goBack);
    return () => listener.remove();
  }, [goBack]);

  const openExternal = useCallback((url: string) => {
    void Linking.openURL(url).catch(() => Alert.alert("Não foi possível abrir este link."));
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={goBack} style={styles.headerButton}>
          <Text style={styles.headerAction}>‹ Voltar</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.brand}>Nego Cortz</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Início do aplicativo" onPress={() => router.dismissTo("/")} style={styles.headerButton}>
          <Text style={styles.headerAction}>Início</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <WebView<unknown>
          ref={web}
          key={attempt}
          source={{ uri: sourceUrl }}
          originWhitelist={["*"]}
          mixedContentMode="never"
          allowFileAccess={false}
          javaScriptCanOpenWindowsAutomatically={false}
          thirdPartyCookiesEnabled={false}
          allowsBackForwardNavigationGestures
          onShouldStartLoadWithRequest={({ url, isTopFrame }) => {
            const type = classifyUrl(url);
            if (type === "internal") return true;
            if (type === "external" && isTopFrame !== false) openExternal(url);
            return false;
          }}
          onOpenWindow={({ nativeEvent: { targetUrl } }) => {
            const type = classifyUrl(targetUrl);
            if (type === "internal") setPopupUrl(targetUrl);
            if (type === "external") openExternal(targetUrl);
          }}
          onNavigationStateChange={(state) => {
            canGoBack.current = state.canGoBack;
            returnHomeAfterLogin(state.url);
          }}
          onMessage={({ nativeEvent }) => {
            if (classifyUrl(nativeEvent.url) === "internal") returnHomeAfterLogin(nativeEvent.data);
          }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setFailed(true); setLoading(false); }}
          onHttpError={({ nativeEvent }) => {
            if (nativeEvent.statusCode >= 500 && classifyUrl(nativeEvent.url) === "internal") {
              setFailed(true);
              setLoading(false);
            }
          }}
          style={styles.web}
        />

        {loading && !failed ? <ActivityIndicator accessibilityLabel="Carregando" color="#075bc5" style={styles.loader} /> : null}
        {failed ? (
          <View style={styles.error}>
            <Text accessibilityRole="header" style={styles.errorTitle}>Não foi possível abrir a agenda</Text>
            <Text style={styles.errorText}>Verifique a internet e tente novamente.</Text>
            <Pressable accessibilityRole="button" style={styles.retry} onPress={() => {
              setFailed(false);
              setLoading(true);
              canGoBack.current = false;
              setAttempt((value) => value + 1);
            }}>
              <Text style={styles.retryText}>Tentar novamente</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.browser} onPress={() => openExternal(SITE_ORIGIN)}>
              <Text style={styles.browserText}>Abrir no navegador</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#101116" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, minHeight: 50 },
  headerButton: { minHeight: 44, minWidth: 64, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  headerAction: { color: "#a8cbff", fontWeight: "700" },
  brand: { color: "#fff", fontSize: 17, fontWeight: "800", textAlign: "center", flexShrink: 1 },
  content: { flex: 1, backgroundColor: "#f6f7f9" },
  web: { flex: 1, backgroundColor: "#f6f7f9" },
  loader: { position: "absolute", right: 14, top: 12 },
  error: { ...StyleSheet.absoluteFill, backgroundColor: "#f6f7f9", justifyContent: "center", alignItems: "center", padding: 24 },
  errorTitle: { fontSize: 23, fontWeight: "800", color: "#13151a", textAlign: "center" },
  errorText: { marginVertical: 12, color: "#505663", textAlign: "center" },
  retry: { minHeight: 48, justifyContent: "center", borderRadius: 12, paddingHorizontal: 18, backgroundColor: "#c91420" },
  retryText: { color: "#fff", fontWeight: "700" },
  browser: { minHeight: 44, justifyContent: "center", marginTop: 4 },
  browserText: { color: "#075bc5", fontWeight: "700" },
});
