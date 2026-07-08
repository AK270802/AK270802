/* ============================================================
   LATENT SPACE — shared page behaviour
   theme toggle · mobile nav · scroll-driven reveals (GSAP)
   ============================================================ */

(function () {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;

  /* -- theme toggle ------------------------------------------
     initial theme is set by the inline head snippet (no FOUC);
     this wires the button and notifies the Three.js scene. */
  const themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const next = root.dataset.theme === "light" ? "dark" : "light";
      root.classList.add("theme-fading");
      root.dataset.theme = next;
      try {
        localStorage.setItem("theme", next);
      } catch {}
      document.dispatchEvent(new CustomEvent("themechange"));
      setTimeout(() => root.classList.remove("theme-fading"), 400);
    });
  }

  /* -- mobile nav -------------------------------------------- */
  const navBtn = document.getElementById("nav-toggle");
  if (navBtn) {
    navBtn.addEventListener("click", () => {
      const open = document.body.classList.toggle("nav-open");
      navBtn.setAttribute("aria-expanded", String(open));
    });
    document.querySelectorAll(".site-nav a").forEach((a) =>
      a.addEventListener("click", () => {
        document.body.classList.remove("nav-open");
        navBtn.setAttribute("aria-expanded", "false");
      })
    );
  }

  /* -- contact form → mailto fallback (no backend) ----------- */
  const form = document.getElementById("contact-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = form.elements.name.value.trim();
      const from = form.elements.email.value.trim();
      const msg = form.elements.message.value.trim();
      const subject = encodeURIComponent(`Portfolio contact — ${name}`);
      const body = encodeURIComponent(`${msg}\n\n— ${name} (${from})`);
      window.location.href = `mailto:avpdazzler2708@gmail.com?subject=${subject}&body=${body}`;
    });
  }

  /* -- scroll-driven reveals ----------------------------------
     GSAP animates FROM hidden states, so content is fully
     visible without JS and for reduced-motion users. */
  if (REDUCED || typeof gsap === "undefined") return;

  if (typeof ScrollTrigger !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
  }

  // word-by-word reveal, as if the headline is being generated
  document.querySelectorAll("[data-words]").forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute("aria-label", el.textContent.trim());
    el.innerHTML = words
      .map((w) => `<span aria-hidden="true" style="display:inline-block">${w}</span>`)
      .join(" ");
    gsap.from(el.children, {
      opacity: 0,
      y: "0.5em",
      duration: 0.7,
      ease: "power3.out",
      stagger: 0.055,
      delay: 0.15,
    });
  });

  // depth-based entrances: rise out of the field, not a flat fade
  gsap.utils.toArray(".reveal").forEach((el) => {
    gsap.from(el, {
      opacity: 0,
      y: 34,
      scale: 0.985,
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
    });
  });
})();
