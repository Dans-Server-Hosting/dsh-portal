import Link from "next/link";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export default function NotFound() {
  return (
    <Stack spacing={2} alignItems="flex-start">
      <Typography variant="h1" component="h1">
        Not found
      </Typography>
      <Typography color="text.secondary">There is nothing at this address, or it has been deleted.</Typography>
      <Button component={Link} href="/" variant="contained">
        Back to the start
      </Button>
    </Stack>
  );
}
