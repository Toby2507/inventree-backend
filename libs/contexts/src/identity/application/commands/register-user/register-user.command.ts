export class RegisterUserCommand {
  constructor(
    public readonly props: {
      id: string;
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
      displayName?: string;
    },
  ) {}
}
