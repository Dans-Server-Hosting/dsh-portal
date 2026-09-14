"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { loginAction, registerAction, type AuthFormState } from "@/app/auth/actions";
import { PASSWORD_MAX, USERNAME_MAX, passwordRules } from "@/lib/credentials";
import PasswordRules from "./PasswordRules";

const INITIAL: AuthFormState = { error: null };

const usernameInputProps = { "data-testid": "username-input", autoCapitalize: "none", autoCorrect: "off", spellCheck: false, maxLength: USERNAME_MAX };

// The fields are controlled because React resets a form's uncontrolled
// inputs once a server action returns, which would wipe what was typed
// whenever UserAuth refuses the request.

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, INITIAL);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  return (
    <Box component="form" action={action} noValidate>
      <Stack spacing={2.5}>
        <TextField
          name="username"
          label="Username"
          required
          fullWidth
          autoComplete="username"
          autoFocus
          disabled={pending}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          inputProps={usernameInputProps}
        />
        <TextField
          name="password"
          label="Password"
          type="password"
          required
          fullWidth
          autoComplete="current-password"
          disabled={pending}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          inputProps={{ "data-testid": "password-input", maxLength: PASSWORD_MAX }}
        />
        {state.error && (
          <Alert severity="error" data-testid="auth-error">
            {state.error}
          </Alert>
        )}
        <Button type="submit" variant="contained" size="large" disabled={pending} data-testid="login-submit">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <Typography variant="body2" color="text.secondary">
          New here?{" "}
          <Link href="/auth/register" data-testid="register-link">
            Create an account
          </Link>
          .
        </Typography>
      </Stack>
    </Box>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, INITIAL);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const rules = passwordRules(password);
  return (
    <Box component="form" action={action} noValidate>
      <Stack spacing={2.5}>
        <TextField
          name="username"
          label="Username"
          required
          fullWidth
          autoComplete="username"
          autoFocus
          disabled={pending}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          helperText="3-50 characters. Case does not matter."
          inputProps={usernameInputProps}
        />
        <Box>
          <TextField
            name="password"
            label="Password"
            type="password"
            required
            fullWidth
            autoComplete="new-password"
            disabled={pending}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            inputProps={{ "data-testid": "password-input", maxLength: PASSWORD_MAX }}
          />
          <PasswordRules rules={rules} />
        </Box>
        <TextField
          name="email"
          label="Email"
          type="email"
          fullWidth
          autoComplete="email"
          disabled={pending}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          helperText="Optional."
          inputProps={{ "data-testid": "email-input", maxLength: 254 }}
        />
        {state.error && (
          <Alert severity="error" data-testid="auth-error">
            {state.error}
          </Alert>
        )}
        <Button type="submit" variant="contained" size="large" disabled={pending} data-testid="register-submit">
          {pending ? "Creating account…" : "Create account"}
        </Button>
        <Typography variant="body2" color="text.secondary">
          Already have an account? <Link href="/auth/login">Sign in</Link>.
        </Typography>
      </Stack>
    </Box>
  );
}
