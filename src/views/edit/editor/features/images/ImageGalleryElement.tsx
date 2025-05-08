import { cn, withRef } from "@udecode/cn";
import { PlateElement, TElement, useElement } from "@udecode/plate-common";
import React from "react";

import * as Dialog from "../../../../../components/Dialog";
import { ImageDisplay } from "./ImageDisplay";

export const ELEMENT_IMAGE_GALLERY = "imageGalleryElement";

type ImageMetadata = {
  alt: string;
  url: string; // "../_attachments/03duel8ega71y7iucmf6uv4zg.png"
  title: string;
};

export interface IImageGalleryElement extends TElement {
  images: ImageMetadata[];
  type: typeof ELEMENT_IMAGE_GALLERY;
}

/**
 * When multiple images appear consecutively in the document, they are grouped
 * into an imageGroupElement node type (see parser). This component displays them
 * as a gallery
 */
export const ImageGalleryElement = withRef<typeof PlateElement>(
  ({ className, children, ...props }, ref) => {
    const element = useElement<IImageGalleryElement>();
    const images = element.images || [];

    return (
      <PlateElement ref={ref} asChild {...props}>
        <>
          <ImageGalleryLightbox images={images} />
          {children}
        </>
      </PlateElement>
    );
  },
);

export const ImageGalleryLightbox = ({
  images,
}: {
  images: ImageMetadata[];
}) => {
  const [open, setOpen] = React.useState(false);
  const [current, setCurrent] = React.useState(0);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      setCurrent((prev) => (prev - 1 + images.length) % images.length);
    } else if (e.key === "ArrowRight") {
      setCurrent((prev) => (prev + 1) % images.length);
    }
  };

  let containerCss = React.useMemo(() => {
    if (images.length > 3) {
      return "flex flex-wrap justify-center gap-[2px] my-12";
    } else {
      return "flex justify-around my-12";
    }
  }, [images.length]);

  let itemCss = React.useMemo(() => {
    if (images.length > 3) {
      return "h-40 min-w-[200px] max-w-[32%] flex-[1_0_auto] basis-auto object-cover relative cursor-zoom-in overflow-hidden";
    } else if (images.length === 2) {
      return "max-h-96 max-w-[48%] object-contain relative cursor-zoom-in overflow-hidden";
    } else {
      // 3 images
      return "max-h-96 max-w-[31%] object-contain relative cursor-zoom-in overflow-hidden";
    }
  }, [images.length]);

  return (
    <>
      <div className={containerCss}>
        {images.map((image, i) => (
          <ImageDisplay
            key={i}
            url={image.url}
            onClick={() => {
              setCurrent(i);
              setOpen(true);
            }}
            className={cn(itemCss, "relative cursor-zoom-in overflow-hidden")}
          />
        ))}
      </div>

      <Dialog.Dialog open={open} onOpenChange={setOpen}>
        <Dialog.DialogPortal>
          <Dialog.DialogOverlay />
          <Dialog.DialogContent
            onKeyDown={handleKey}
            variant="max"
            aria-description="Press left/right arrow keys to navigate"
          >
            <Dialog.DialogTitle className="hidden">
              Expanded image {current}
            </Dialog.DialogTitle>
            <img
              src={images[current]?.url}
              className="mb-0 max-h-full max-w-full object-contain"
            />
            <Dialog.DialogClose className="absolute right-4 top-4 text-white hover:text-gray-300" />
          </Dialog.DialogContent>
        </Dialog.DialogPortal>
      </Dialog.Dialog>
    </>
  );
};
