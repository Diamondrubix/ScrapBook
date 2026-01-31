import type { PresenceUser } from "../hooks/usePresence";

type PresenceLayerProps = {
  users: PresenceUser[];
};

export function PresenceLayer({ users }: PresenceLayerProps) {
  return (
    <>
      {users.map((user) => (
        <div
          key={user.user_id}
          className="cursor"
          style={{ transform: `translate(${user.cursor.x}px, ${user.cursor.y}px)` }}
        >
          <span className="cursor-dot" style={{ background: user.color }} />
          <span>{user.display_name}</span>
        </div>
      ))}
    </>
  );
}
