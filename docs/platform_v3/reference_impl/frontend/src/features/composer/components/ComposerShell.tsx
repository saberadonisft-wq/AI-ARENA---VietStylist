import React from "react";

export function ComposerShell(props: {
  closet: React.ReactNode;
  preview: React.ReactNode;
  culture: React.ReactNode;
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "280px minmax(0, 1fr) 320px",
      gap: 16
    }}>
      <aside>{props.closet}</aside>
      <main>{props.preview}</main>
      <aside>{props.culture}</aside>
    </div>
  );
}
