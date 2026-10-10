import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import styled from "styled-components";
import { appTheme } from "../../project/brand/project";

// In-app replacement for window.confirm: `if (await confirmDialog({ message })) ...`
//
// Mounted in its own root straight on <body>, above every app overlay, with
// plain buttons. The earlier popup (core/message) shared the forms' z-index and
// their FormInput buttons and did not reliably show or respond on mobile; this
// one depends on none of that, and works outside React too (pwa.js).

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 100000; /* forms and messages use 1001, the highest overlay 10001 */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.5);
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 440px;
  max-height: 85dvh;
  background: ${appTheme.bg.white};
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  overflow: hidden;
`;

const Message = styled.div`
  padding: 24px;
  font-size: 16px;
  line-height: 1.5;
  color: ${appTheme.text.main};
  white-space: pre-line;
  overflow-y: auto;
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-shrink: 0;
  padding: 16px 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);

  @media (max-width: 480px) {
    padding: 16px;
    & > button {
      flex: 1;
    }
  }
`;

const Button = styled.button`
  min-height: 44px;
  padding: 0 20px;
  border-radius: 10px;
  border: 1px solid ${appTheme.bg.soft};
  background: ${appTheme.bg.white};
  color: ${appTheme.text.main};
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;

  &.confirm {
    border-color: transparent;
    background: ${appTheme.primary.base};
    color: ${appTheme.bg.white};
  }

  &.confirm.danger {
    background: #dc2626;
  }

  &:focus-visible {
    outline: 2px solid ${appTheme.primary.base};
    outline-offset: 2px;
  }
`;

const ConfirmDialog = ({ message, confirmLabel, cancelLabel, danger, onClose }) => {
  const cancelRef = useRef(null);

  useEffect(() => {
    // Focus Cancel so a stray Enter never confirms a destructive action.
    cancelRef.current?.focus();
    const onKeyDown = (event) => event.key === "Escape" && onClose(false);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <Overlay onClick={() => onClose(false)}>
      <Card role="alertdialog" aria-modal="true" aria-describedby="confirm-dialog-message" onClick={(event) => event.stopPropagation()}>
        <Message id="confirm-dialog-message">{message}</Message>
        <Actions>
          <Button ref={cancelRef} type="button" onClick={() => onClose(false)}>
            {cancelLabel}
          </Button>
          <Button type="button" className={danger ? "confirm danger" : "confirm"} onClick={() => onClose(true)}>
            {confirmLabel}
          </Button>
        </Actions>
      </Card>
    </Overlay>
  );
};

// A second call while a dialog is open (e.g. a double tap) gets the same answer
// instead of stacking another dialog.
let pending = null;

export const confirmDialog = ({ message, confirmLabel = "OK", cancelLabel = "Cancel", danger = false }) => {
  if (pending) return pending;
  pending = new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    let closed = false;
    const close = (result) => {
      if (closed) return;
      closed = true;
      pending = null;
      resolve(result);
      // Unmount after the click that closed it has finished.
      setTimeout(() => {
        root.unmount();
        host.remove();
      });
    };
    root.render(<ConfirmDialog message={message} confirmLabel={confirmLabel} cancelLabel={cancelLabel} danger={danger} onClose={close} />);
  });
  return pending;
};
