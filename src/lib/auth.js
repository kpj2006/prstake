import GitHubProvider from "next-auth/providers/github";

export const authOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET
    })
  ],
  callbacks: {
    async jwt({ token, profile }) {
      if (profile?.login) {
        token.githubUsername = profile.login;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.githubUsername = token.githubUsername || session.user.name;
      }
      return session;
    }
  }
};
