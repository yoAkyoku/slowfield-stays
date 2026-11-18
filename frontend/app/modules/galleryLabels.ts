/** Labels for a photo strip's controls (stay cards, the homepage gallery), in
 *  the reader's language. The homepage gallery labelled its arrows in English
 *  on the Chinese page. */
export function galleryLabels(zh: boolean) {
  return {
    previous: zh ? "上一張" : "Previous image",
    next: zh ? "下一張" : "Next image",
    group: zh ? "照片" : "Photos",
    photo: (n: number) => (zh ? `第 ${n} 張` : `Image ${n}`),
    status: (n: number, total: number) => (zh ? `第 ${n} 張，共 ${total} 張` : `Image ${n} of ${total}`),
  };
}
