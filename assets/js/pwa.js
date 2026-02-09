/**
 * pwa.js — registro do Service Worker + botão de instalação
 */
window.PWA = (() => {
  let deferredPrompt = null;

  async function registerSW(){
    if(!("serviceWorker" in navigator)) return;
    try{
      await navigator.serviceWorker.register("./sw.js");
      console.log("SW registrado");
    }catch(e){
      console.warn("Falha ao registrar SW", e);
    }
  }

  function setupInstallButton(){
    const btn = document.getElementById("btnInstall");
    if(!btn) return;

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      btn.style.display = "inline-block";
    });

    btn.addEventListener("click", async () => {
      if(!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      btn.style.display = "none";
    });
  }

  function watchOnlineBadge(){
    const pill = document.getElementById("offlinePill");
    if(!pill) return;

    function update(){
      const on = navigator.onLine;
      pill.textContent = on ? "Online" : "Offline";
      pill.style.borderColor = on ? "rgba(231,238,252,.12)" : "rgba(24,195,126,.45)";
      pill.style.background = on ? "transparent" : "rgba(24,195,126,.12)";
      pill.style.color = on ? "rgba(168,183,216,.9)" : "rgba(231,238,252,.9)";
    }
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
  }

  return { registerSW, setupInstallButton, watchOnlineBadge };
})();
