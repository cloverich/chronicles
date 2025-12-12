import { withRef } from "@udecode/cn";
import { PlateElement, TElement, useElement } from "@udecode/plate-common";
import React from "react";

import { Button } from "../../../../../components/Button";
import * as Dialog from "../../../../../components/Dialog";
import { Icons } from "../../../../../components/icons";
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
      return "flex flex-wrap justify-around gap-[2px] my-12 relative";
    } else {
      return "flex justify-around my-12 relative";
    }
  }, [images.length]);

  let itemCss = React.useMemo(() => {
    if (images.length === 2) {
      return "flex items-start max-h-96 max-w-[48%]  relative overflow-hidden";
    } else {
      // 3 images
      return "flex items-start max-h-96 max-w-[31%]  relative overflow-hidden";
    }
  }, [images.length]);

  let imgCss = React.useMemo(() => {
    if (images.length > 3) {
      return "object-cover relative cursor-zoom-in max-w-full max-h-full";
    } else if (images.length === 2) {
      return "object-contain relative cursor-zoom-in max-w-full max-h-full";
    } else {
      // 3 images
      return "object-contain relative cursor-zoom-in max-w-full max-h-full";
    }
  }, [images.length]);

  return (
    <>
      <div className={containerCss}>
        {images.slice(0, 3).map((image, i) => (
          <div className={itemCss} key={i}>
            <ImageDisplay
              key={i}
              url={image.url}
              onClick={() => {
                setCurrent(i);
                setOpen(true);
              }}
              className={imgCss}
              displayOverlay={true}
            />
          </div>
        ))}
        {images.length > 3 && (
          <Button
            variant="ghost"
            className="absolute bottom-0 right-0"
            onClick={() => {
              setCurrent(3);
              setOpen(true);
            }}
          >
            <Icons.image className="ml-auto size-2" /> {images.length - 3}{" "}
            more...
          </Button>
        )}
      </div>

      <Dialog.DialogRoot open={open} onOpenChange={setOpen}>
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
              className="mb-0 max-h-full max-w-full border border-black object-contain shadow-sm"
            />
            <Dialog.DialogClose className="absolute right-4 top-4 text-white hover:text-gray-300" />
          </Dialog.DialogContent>
        </Dialog.DialogPortal>
      </Dialog.DialogRoot>
    </>
  );
};
