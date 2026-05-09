export class RegisterUserCommand {
  constructor(
    public readonly props: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
      displayName?: string;
    },
  ) {}
}
