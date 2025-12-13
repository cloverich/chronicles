import React from "react";
import { Button } from "../../../../components/Button";
import {
  DialogRoot as Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../../components/Dialog";
import { Icons } from "../../../../components/icons";

export default function Welcome({ onComplete }: { onComplete: () => void }) {
  function ackNewUser() {
    onComplete();
  }

  return (
    <Dialog defaultOpen={true} onOpenChange={ackNewUser}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Welcome to Chronicles!</DialogTitle>
          <DialogDescription asChild>
            <div>
              <p>
                The app organizes markdown notes into journals, sorting by time,
                and has basic tagging and search features. To get started:
              </p>

              <ul className="my-6 ml-6 list-disc [&>li]:mt-2">
                <li>
                  Use <Icons.editing className="mx-1 inline" /> to create a new
                  note
                </li>
                <li>
                  Use the sidebar <Icons.panelRight className="mx-1 inline" />{" "}
                  to view and edit journals and #tags
                </li>
                <li>
                  Use <Icons.settings className="mx-1 inline" /> to import your
                  existing markdown notes, or see where Chronicles stores its
                  data{" "}
                </li>
              </ul>

              <p>
                The application is still in development, you can{" "}
                <a
                  className="font-medium underline underline-offset-4"
                  href="https://github.com/cloverich/chronicles/releases"
                >
                  follow releases
                </a>
                &nbsp; for updates. If you have feedback, feel free to open an
                issue on the Github repository - but check&nbsp;
                <a
                  className="font-medium underline underline-offset-4"
                  href="https://github.com/cloverich/chronicles/issues/160"
                >
                  the roadmap
                </a>
                &nbsp;first!
              </p>

              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-4"
                >
                  Got it
                </Button>
              </DialogClose>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
