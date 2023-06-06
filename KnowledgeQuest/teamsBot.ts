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
import { AdaptiveCards } from "@microsoft/adaptivecards-tools";
import { Configuration, OpenAIApi } from "openai";
import config from "./config";
import { StartSelfAssessment } from "./adaptiveCards/models/StartSelfAssessment";

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
        // Call OpenAI to get the assessment questions
        const configuration = new Configuration({
          apiKey: config.openAIKey,
        });

        const openai = new OpenAIApi(configuration);

        const completion = await openai.createCompletion({
            model: "text-davinci-003",
            prompt: `Generate ${invokeValue.action.data.numofquestions} multichoice questions with correct answer option and reference links on ${invokeValue.action.data.assessmenttopic}`,
        });

        var a = completion.data;

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
