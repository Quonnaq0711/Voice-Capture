export default function MobileMenuOverlay({ isVisible, onClose }) {
  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-40 mt-16"
      onClick={onClose}
    />
  );
}