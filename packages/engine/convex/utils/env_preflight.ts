import { ProviderType } from "../models/_shared";


const PROVIDER_ENV: Record<ProviderType, string> = {
  openai: "OPENAI_API_KEY",
};

// todo, define env preflights