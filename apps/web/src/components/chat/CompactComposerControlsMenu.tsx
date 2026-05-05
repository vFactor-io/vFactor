import { ProviderInteractionMode } from "@t3tools/contracts";
import { memo, type ReactNode } from "react";
import { EllipsisIcon, ListTodoIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Menu, MenuItem, MenuPopup, MenuSeparator as MenuDivider, MenuTrigger } from "../ui/menu";
import { composerControlButtonClassName } from "./composerControlStyles";

export const CompactComposerControlsMenu = memo(function CompactComposerControlsMenu(props: {
  activePlan: boolean;
  interactionMode: ProviderInteractionMode;
  planSidebarLabel: string;
  planSidebarOpen: boolean;
  traitsMenuContent?: ReactNode;
  onToggleInteractionMode: () => void;
  onTogglePlanSidebar: () => void;
}) {
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className={`${composerControlButtonClassName} shrink-0 px-2`}
            aria-label="More composer controls"
          />
        }
      >
        <EllipsisIcon aria-hidden="true" className="size-4" />
      </MenuTrigger>
      <MenuPopup align="start">
        {props.traitsMenuContent ? (
          <>
            {props.traitsMenuContent}
            <MenuDivider />
          </>
        ) : null}
        {props.interactionMode === "plan" ? (
          <>
            <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">Mode</div>
            <MenuItem onClick={props.onToggleInteractionMode}>
              <span className="flex-1">Plan mode</span>
              <span className="text-muted-foreground text-xs">On</span>
            </MenuItem>
            <MenuDivider />
          </>
        ) : null}
        {props.activePlan ? (
          <>
            <MenuDivider />
            <MenuItem onClick={props.onTogglePlanSidebar}>
              <ListTodoIcon className="size-4 shrink-0" />
              {props.planSidebarOpen
                ? `Hide ${props.planSidebarLabel.toLowerCase()} sidebar`
                : `Show ${props.planSidebarLabel.toLowerCase()} sidebar`}
            </MenuItem>
          </>
        ) : null}
      </MenuPopup>
    </Menu>
  );
});
