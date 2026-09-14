import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import type { PasswordRule } from "@/lib/credentials";

/** The live checklist under a password field, shared by registration and the account page. */
export default function PasswordRules({ rules }: { rules: PasswordRule[] }) {
  return (
    <List dense disablePadding sx={{ mt: 0.5 }} aria-label="Password rules" data-testid="password-rules">
      {rules.map((rule) => (
        <ListItem key={rule.label} disableGutters sx={{ py: 0 }} data-testid="password-rule" data-ok={rule.ok}>
          <ListItemIcon sx={{ minWidth: 28 }}>
            {rule.ok ? <CheckCircleOutlineIcon fontSize="small" color="success" /> : <RadioButtonUncheckedIcon fontSize="small" color="disabled" />}
          </ListItemIcon>
          <ListItemText primary={rule.label} primaryTypographyProps={{ variant: "body2", color: rule.ok ? "text.primary" : "text.secondary" }} />
        </ListItem>
      ))}
    </List>
  );
}
