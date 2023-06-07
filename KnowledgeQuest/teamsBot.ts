import {
  TeamsActivityHandler,
  CardFactory,
  TurnContext,
  AdaptiveCardInvokeValue,
  AdaptiveCardInvokeResponse,
} from "botbuilder";
import rawWelcomeCard from "./adaptiveCards/welcome.json";
import rawLearnCard from "./adaptiveCards/learn.json";
import rawSelectSelfassessmentCard from "./adaptiveCards/selectselfassessment.json";
import rawAssessmentquestionsCard from "./adaptiveCards/assessmentquestions.json";
import { AdaptiveCards } from "@microsoft/adaptivecards-tools";
import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
// import { Configuration, OpenAIApi } from "openai";
import config from "./config";
import { StartSelfAssessment } from "./adaptiveCards/models/StartSelfAssessment";
import { AssessmentQuestions } from "./adaptiveCards/models/AssessmentQuestions";

export interface DataInterface {
  likeCount: number;
}

export class TeamsBot extends TeamsActivityHandler {
  // record the likeCount
  likeCountObj: { likeCount: number };

  constructor() {
    super();

    this.likeCountObj = { likeCount: 0 };

    this.onMessage(async (context, next) => {
      console.log("Running with Message Activity.");

      let txt = context.activity.text;
      const removedMentionText = TurnContext.removeRecipientMention(context.activity);
      if (removedMentionText) {
        // Remove the line break
        txt = removedMentionText.toLowerCase().replace(/\n|\r/g, "").trim();
      }

      // Trigger command by IM text
      switch (txt) {
        case "welcome": {
          const card = AdaptiveCards.declareWithoutData(rawWelcomeCard).render();
          await context.sendActivity({ attachments: [CardFactory.adaptiveCard(card)] });
          break;
        }
        case "learn": {
          this.likeCountObj.likeCount = 0;
          const card = AdaptiveCards.declare<DataInterface>(rawLearnCard).render(this.likeCountObj);
          await context.sendActivity({ attachments: [CardFactory.adaptiveCard(card)] });
          break;
        }
        /**
         * case "yourCommand": {
         *   await context.sendActivity(`Add your response here!`);
         *   break;
         * }
         */
      }

      // By calling next() you ensure that the next BotHandler is run.
      await next();
    });

    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      for (let cnt = 0; cnt < membersAdded.length; cnt++) {
        if (membersAdded[cnt].id) {
          const card = AdaptiveCards.declareWithoutData(rawWelcomeCard).render();
          await context.sendActivity({ attachments: [CardFactory.adaptiveCard(card)] });
          break;
        }
      }
      await next();
    });
  }

  // Invoked when an action is taken on an Adaptive Card. The Adaptive Card sends an event to the Bot and this
  // method handles that event.
  async onAdaptiveCardInvoke(
    context: TurnContext,
    invokeValue: AdaptiveCardInvokeValue
  ): Promise<AdaptiveCardInvokeResponse> {
    // The verb "userlike" is sent from the Adaptive Card defined in adaptiveCards/learn.json
    if (invokeValue.action.verb === "userlike") {
      this.likeCountObj.likeCount++;
      const card = AdaptiveCards.declare<DataInterface>(rawLearnCard).render(this.likeCountObj);
      await context.updateActivity({
        type: "message",
        id: context.activity.replyToId,
        attachments: [CardFactory.adaptiveCard(card)],
      });
      return { statusCode: 200, type: undefined, value: undefined };
    }

    switch (invokeValue.action.verb) {
      case "selectselfassessment":
        // The verb "selectselfassessment" is sent from the Adaptive Card defined in adaptiveCards/selectselfassessment.json  
        const card = AdaptiveCards.declareWithoutData(rawSelectSelfassessmentCard).render();
        await context.sendActivity({ attachments: [CardFactory.adaptiveCard(card)] });

        break;

      case "mystats":
        break;

      case "startselfassessment":
        // The verb "startselfassessment" is sent from the Adaptive Card defined in adaptiveCards/welcome.json
        // Call Azure OpenAI to get the assessment questions
        // const prompt = [`Generate ${invokeValue.action.data.numofquestions} multichoice questions with correct answer option and reference links on ${invokeValue.action.data.assessmenttopic} in JSON format`];

        // // You will need to set these environment variables or edit the following values
        // const endpoint = config.endpoint;
        // const azureApiKey = config.azureApiKey;

        // const client = new OpenAIClient(endpoint, new AzureKeyCredential(azureApiKey));
        // const deploymentId = "text-davinci-003";

        // const result = await client.getCompletions(deploymentId, prompt, { maxTokens: 4000 });
        // for (const choice of result.choices) {
        //   console.log(choice.text);
        // }

        var choiceText = `{
          questions: [
            {
              question: "What are the main components of the Azure platform?",
              options: [
                "Storage Accounts, Virtual Machines and Data Lakes",
                "Storage Services, HDInsight and Worker Roles",
                "App Services, Data Factory and Redis Cache",
                "Virtual Networks, Web Apps and Service Bus"
              ],
              answer: 3,
              referenceLink: "https://docs.microsoft.com/en-us/azure/architecture/overview/"
            },
            {
              question: "Which of the following is not a component of the Azure platform?",
              options: [
                "Azure Funtions",
                "Azure Networking",
                "Azure Virtual Machine",
                "Azure Database"
              ],
              answer: 1,
              referenceLink: "https://docs.microsoft.com/en-us/azure/architecture/overview/"
            },
            {
              question: "What does the Azure Virtual Network service provide?",
              options: [
                "A set of virtualization tools",
                "A virtual private cloud",
                "A web hosting platform",
                "A messaging system"
              ],
              answer: 1,
              referenceLink: "https://docs.microsoft.com/en-us/azure/virtual-network/"
            },
            {
              question: "Which of the following services is part of the Azure Database offering?",
              options: [
                "Azure SQL Database",
                "Cosmos DB",
                "Azure Storage",
                "Azure App Services"
              ],
              answer: 0,
              referenceLink: "https://docs.microsoft.com/en-us/azure/azure-database/"
            },
            {
              question: "What is the primary benefit of using the Azure Service Bus?",
              options: [
                "Providing a fully managed storage solution",
                "Enabling the creation of backend services",
                "Allowing for secure communication between distributed systems",
                "Creating a private cloud platform"
              ],
              answer: 2,
              referenceLink: "https://docs.microsoft.com/en-us/azure/service-bus/"
            }
          ]
        }`;

        // Fix missing quotation marks on keys in JSON
        choiceText = choiceText.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:([^\/])/g, '"$2":$4');

        var jsonObject: AssessmentQuestions = JSON.parse(choiceText);

        const assessmentCard = AdaptiveCards.declare<AssessmentQuestions>(rawAssessmentquestionsCard).render(jsonObject);
        await context.updateActivity({
          type: "message",
          id: context.activity.replyToId,
          attachments: [CardFactory.adaptiveCard(assessmentCard)],
        });
        return { statusCode: 200, type: undefined, value: undefined };

        // NEXT
        // Render your adaptive card for reply message
        //   const cardData: CardData = {
        //     title: "Hello from OpenAI",
        //     body: completion.data.choices[0].text,
        // };

        // const cardJson = AdaptiveCards.declare(helloWorldCard).render(cardData);
        // return MessageFactory.attachment(CardFactory.adaptiveCard(cardJson));
        break;
    }
  }
}
