const baseUrl = process.env.BASE_URL;

if (!baseUrl) {
  throw new Error("BASE_URL is not set");
}

const link = `${baseUrl}/api/verify?token=${token}`;
