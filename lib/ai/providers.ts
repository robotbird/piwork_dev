import { customProvider, gateway } from "ai";
import {
  chatModel as mockChatModel,
  titleModel as mockTitleModel,
} from "@/tests/fixtures/legacy-ai-sdk-models";
import { isTestEnvironment } from "../constants";
import { titleModel } from "./models";

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        "chat-model": mockChatModel,
        "title-model": mockTitleModel,
      },
    })
  : null;

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  return gateway.languageModel(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  return gateway.languageModel(titleModel.id);
}
