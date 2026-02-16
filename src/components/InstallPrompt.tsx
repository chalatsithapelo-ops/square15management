import { useState, useEffect, useCallback } from "react";
import { X, Download, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/**
 * PWA Install Prompt Component
 * 
 * Shows a banner prompting users to install the app on their device.
 * - On Android/Chrome: Uses the native beforeinstallprompt event
 * - On iOS: Shows instructions to use "Add to Home Screen"
 * - On desktop: Shows install button if supported
 * 
 * The prompt is dismissible and remembers the user's choice for 7 days.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode) or running in TWA
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as any).standalone === true
      || document.referrer.startsWith('android-app://');
    setIsStandalone(standalone);

    if (standalone) return; // Don't show prompt if already installed or in TWA

    // Check if user dismissed recently
    const dismissedAt = localStorage.getItem("pwa-install-dismissed");
    if (dismissedAt) {
      const dismissedDate = new Date(dismissedAt);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) return; // Don't show for 7 days after dismissal
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      // On iOS, show our custom prompt after a delay
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Listen for the beforeinstallprompt event (Chrome/Edge/Android)
    // Check if it was already captured globally before React mounted
    const captured = (window as any).__pwaInstallPrompt;
    if (captured) {
      setDeferredPrompt(captured as BeforeInstallPromptEvent);
      setTimeout(() => setShowPrompt(true), 1500);
      (window as any).__pwaInstallPrompt = null;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after a short delay
      setTimeout(() => setShowPrompt(true), 1500);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Listen for successful installation
    window.addEventListener("appinstalled", () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
      console.log("PWA installed successfully");
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === "accepted") {
        console.log("User accepted the install prompt");
      } else {
        console.log("User dismissed the install prompt");
        localStorage.setItem("pwa-install-dismissed", new Date().toISOString());
      }
      
      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      console.error("Install prompt error:", error);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    setShowIOSInstructions(false);
    localStorage.setItem("pwa-install-dismissed", new Date().toISOString());
  }, []);

  // Don't render if already installed or prompt shouldn't show
  if (isStandalone || !showPrompt) return null;

  // iOS-specific instructions
  if (isIOS) {
    return (
      <>
        {/* Banner */}
        <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
          <div className="mx-auto max-w-lg px-4 pb-4">
            <div className="rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#2D5016] rounded-xl flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Install Square 15
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Add to your home screen for quick access
                    </p>
                  </div>
                  <button
                    onClick={handleDismiss}
                    className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
                    aria-label="Dismiss"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setShowIOSInstructions(true)}
                    className="flex-1 bg-[#2D5016] text-white text-sm font-medium py-2.5 px-4 rounded-xl hover:bg-[#1e3a0f] transition-colors"
                  >
                    Show Me How
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Not Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* iOS Instructions Modal */}
        {showIOSInstructions && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50">
            <div className="w-full max-w-lg bg-white rounded-t-2xl p-6 animate-slide-up">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Install on iPhone/iPad
                </h3>
                <button
                  onClick={() => setShowIOSInstructions(false)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-[#2D5016] text-white text-sm font-bold rounded-full flex items-center justify-center">
                    1
                  </span>
                  <p className="text-sm text-gray-700 pt-1">
                    Tap the <strong>Share</strong> button{" "}
                    <span className="inline-block align-middle">
                      <svg className="w-5 h-5 inline text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </span>{" "}
                    at the bottom of Safari
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-[#2D5016] text-white text-sm font-bold rounded-full flex items-center justify-center">
                    2
                  </span>
                  <p className="text-sm text-gray-700 pt-1">
                    Scroll down and tap <strong>"Add to Home Screen"</strong>
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-[#2D5016] text-white text-sm font-bold rounded-full flex items-center justify-center">
                    3
                  </span>
                  <p className="text-sm text-gray-700 pt-1">
                    Tap <strong>"Add"</strong> to install
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSInstructions(false)}
                className="w-full mt-6 bg-[#2D5016] text-white text-sm font-medium py-3 px-4 rounded-xl hover:bg-[#1e3a0f] transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Android / Chrome / Desktop prompt
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
      <div className="mx-auto max-w-lg px-4 pb-4">
        <div className="rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-12 h-12 bg-[#2D5016] rounded-xl flex items-center justify-center">
                <Download className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900">
                  Install Square 15
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Install the app for faster access and offline support
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
                aria-label="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleInstall}
                className="flex-1 bg-[#2D5016] text-white text-sm font-medium py-2.5 px-4 rounded-xl hover:bg-[#1e3a0f] transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Install App
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Not Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
