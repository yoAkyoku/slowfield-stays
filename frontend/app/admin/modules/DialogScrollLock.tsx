"use client";

import { useEffect } from "react";

/** Keep the admin page anchored while a native dialog owns its own scroll area. */
export default function DialogScrollLock() {
  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    let previous: {
      scrollY: number;
      rootOverflowY: string;
      rootScrollBehavior: string;
      bodyStyle: {
        position: string;
        top: string;
        left: string;
        right: string;
        width: string;
        overflow: string;
        paddingRight: string;
      };
    } | null = null;

    const unlock = () => {
      if (!previous) return;
      const saved = previous;
      previous = null;
      body.style.position = saved.bodyStyle.position;
      body.style.top = saved.bodyStyle.top;
      body.style.left = saved.bodyStyle.left;
      body.style.right = saved.bodyStyle.right;
      body.style.width = saved.bodyStyle.width;
      body.style.overflow = saved.bodyStyle.overflow;
      body.style.paddingRight = saved.bodyStyle.paddingRight;
      root.style.overflowY = saved.rootOverflowY;
      // The site enables smooth scrolling globally. Temporarily override it so
      // returning focus to the dialog trigger cannot animate away from the
      // exact page position that was saved when the dialog opened.
      root.style.scrollBehavior = "auto";
      window.scrollTo(0, saved.scrollY);
      root.style.scrollBehavior = saved.rootScrollBehavior;
    };

    let unlockFrame = 0;
    let finalUnlockFrame = 0;
    const cancelScheduledUnlock = () => {
      if (unlockFrame) window.cancelAnimationFrame(unlockFrame);
      if (finalUnlockFrame) window.cancelAnimationFrame(finalUnlockFrame);
      unlockFrame = 0;
      finalUnlockFrame = 0;
    };
    const scheduleUnlock = () => {
      if (!previous || unlockFrame || finalUnlockFrame) return;
      // Native dialogs restore focus to their trigger on close. Wait until that
      // focus restoration has finished before restoring the saved scroll.
      unlockFrame = window.requestAnimationFrame(() => {
        finalUnlockFrame = window.requestAnimationFrame(() => {
          unlockFrame = 0;
          finalUnlockFrame = 0;
          if (body.querySelector("dialog[open]") === null) unlock();
        });
      });
    };

    const sync = () => {
      const hasOpenDialog = body.querySelector("dialog[open]") !== null;
      if (!hasOpenDialog) {
        scheduleUnlock();
        return;
      }
      cancelScheduledUnlock();
      if (previous) return;

      const scrollY = window.scrollY;
      previous = {
        scrollY,
        rootOverflowY: root.style.overflowY,
        rootScrollBehavior: root.style.scrollBehavior,
        bodyStyle: {
          position: body.style.position,
          top: body.style.top,
          left: body.style.left,
          right: body.style.right,
          width: body.style.width,
          overflow: body.style.overflow,
          paddingRight: body.style.paddingRight,
        },
      };

      const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth);
      const currentPaddingRight = Number.parseFloat(getComputedStyle(body).paddingRight) || 0;
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "auto";
      body.style.overflow = "hidden";
      if (scrollbarWidth > 0) body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
      root.style.overflowY = "hidden";
    };

    // showModal() is a native method and may not produce a mutation that the
    // observer can use consistently across browsers. Recheck after the
    // triggering event so the React handler has had time to open the dialog.
    let firstFrame = 0;
    let secondFrame = 0;
    const scheduleSync = () => {
      if (firstFrame) window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
          firstFrame = 0;
          secondFrame = 0;
          sync();
        });
      });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") scheduleSync();
    };

    const observer = new MutationObserver(sync);
    observer.observe(body, {
      attributes: true,
      attributeFilter: ["open"],
      childList: true,
      subtree: true,
    });
    document.addEventListener("click", scheduleSync, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("close", scheduleSync, true);
    sync();

    return () => {
      observer.disconnect();
      document.removeEventListener("click", scheduleSync, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("close", scheduleSync, true);
      if (firstFrame) window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      cancelScheduledUnlock();
      unlock();
    };
  }, []);

  return null;
}
