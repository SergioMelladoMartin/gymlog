/**
 * Single global mount point for the app's cross-cutting UI: the toast queue
 * and the confirm-dialog host. Mounted once in Layout.astro as a
 * `client:only="react"` island with `transition:persist` so it survives
 * Astro view transitions without remounting (which would drop in-flight
 * toasts/confirms). See Toast.tsx and ConfirmDialog.tsx for the public API.
 */
import ToastHost from './Toast';
import ConfirmDialogHost from './ConfirmDialog';

export default function UIHost() {
  return (
    <>
      <ToastHost />
      <ConfirmDialogHost />
    </>
  );
}
