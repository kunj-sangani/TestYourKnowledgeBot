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
import rawInformationPanelCard from "./adaptiveCards/informationpanel.json";
import { AdaptiveCards } from "@microsoft/adaptivecards-tools";
import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
// import { Configuration, OpenAIApi } from "openai";
import config from "./config";
import { StartSelfAssessment } from "./adaptiveCards/models/StartSelfAssessment";
import { Question, OptionSet } from "./adaptiveCards/models/AssessmentQuestions";
import { InformationPanel } from "./adaptiveCards/models/InformationPanel";

export interface DataInterface {
  likeCount: number;
}

export class TeamsBot extends TeamsActivityHandler {
  // record the likeCount
  likeCountObj: { likeCount: number };
  assessmentQuestionsObj: { assessmentQuestions: Question[] };
  assessmentQuestionIndexObj: { assessmentQuestionIndex: number };
  correctAnswersObj: { correctAnswers: number };

  constructor() {
    super();

    this.likeCountObj = { likeCount: 0 };
    this.assessmentQuestionsObj = { assessmentQuestions: null };
    this.assessmentQuestionIndexObj = { assessmentQuestionIndex: 0 };
    this.correctAnswersObj = { correctAnswers: 0 };

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
        await context.sendActivity(`Please wait while we generate your self assessment...`);

        // Call Azure OpenAI to get the assessment questions
        const prompt = [`Generate ${invokeValue.action.data.numofquestions} multichoice questions with correct answer option and reference links on ${invokeValue.action.data.assessmenttopic} in JSON format with elements as question, options, answer, and referenceLink`];

        // You will need to set these environment variables or edit the following values
        const endpoint = config.endpoint;
        const azureApiKey = config.azureApiKey;

        // const client = new OpenAIClient(endpoint, new AzureKeyCredential(azureApiKey));
        // const deploymentId = "text-davinci-003";

        // const result = await client.getCompletions(deploymentId, prompt, { maxTokens: 4000 });
        // var choiceText = "";
        // for (const choice of result.choices) {
        //   choiceText = choice.text;
        // }

        var choiceText = `
        [
          {
              "question": "Which of the following is an Open-Source Platform offered by Microsoft Azure?",
              "options": [
                  "A) Amazon EC2",
                  "B) Red Hat OpenShift",
                  "C) Google Cloud Platform",
                  "D) Microsoft Azure Cloud Services"
              ],
              "answer": "B) Red Hat OpenShift",
              "referenceLink": "https://azure.microsoft.com/en-us/features/openshift/"
          },
          {
              "question": "What is the purpose of Azure Data Lake?",
              "options": [
                  "A) To store data in the cloud",
                  "B) To process data in the cloud",
                  "C) To query data in the cloud",
                  "D) To replicate data in the cloud"
              ],
              "answer": "B) To process data in the cloud",
              "referenceLink": "https://docs.microsoft.com/en-us/azure/data-lake-store/data-lake-store-what-is-it"
          },
          {
              "question": "What is the name of the open source container platform offered by Microsoft Azure?",
              "options": [
                  "A) Azure Kubernetes Service",
                  "B) Azure Container Service",
                  "C) Azure Service Fabric",
                  "D) Azure Container Instances"
              ],
              "answer": "A) Azure Kubernetes Service",
              "referenceLink": "https://azure.microsoft.com/en-us/services/kubernetes-service/"
          },
          {
              "question": "Which Azure service is primarily used to detect anomalies in a dataset?",
              "options": [
                  "A) Azure Machine Learning Service",
                  "B) Azure Cognitive Services",
                  "C) Azure Data Factory",
                  "D) Azure Event Hub"
              ],
              "answer": "A) Azure Machine Learning Service",
              "referenceLink": "https://azure.microsoft.com/en-us/services/machine-learning-service/"
          },
          {
              "question": "Which of the following metrics provide an indication of how much load your system is currently experiencing?",
              "options": [
                  "A) Bandwidth",
                  "B) Throughput",
                  "C) Latency",
                  "D) Utilization"
              ],
              "answer": "D) Utilization",
              "referenceLink": "https://docs.microsoft.com/en-us/azure/azure-monitor/fundamentals/metrics-concepts"
          }
      ]`;

        // Fix missing quotation marks on keys in JSON
        choiceText = choiceText.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:([^\/])/g, '"$2":$4');

        this.assessmentQuestionsObj.assessmentQuestions = JSON.parse(choiceText);
        this.assessmentQuestionIndexObj.assessmentQuestionIndex = 1;

        this.assessmentQuestionsObj.assessmentQuestions.forEach(question => {
          const choiceSetOptions: OptionSet[] = question.options.map((option, index) => ({
            title: option,
            value: option
          }));

          question.optionSet = choiceSetOptions;
        });

        const assessmentCard = AdaptiveCards.declare<Question>(rawAssessmentquestionsCard).render(this.assessmentQuestionsObj.assessmentQuestions[0]);
        await context.sendActivity({ attachments: [CardFactory.adaptiveCard(assessmentCard)] });

        break;

      case 'nextquestion':
        if (this.assessmentQuestionIndexObj.assessmentQuestionIndex < this.assessmentQuestionsObj.assessmentQuestions.length) {
          var userAnswer = invokeValue.action.data.answerChoice;
          var correctAnswer = this.assessmentQuestionsObj.assessmentQuestions[this.assessmentQuestionIndexObj.assessmentQuestionIndex].answer;

          if (userAnswer === correctAnswer) {
            this.correctAnswersObj.correctAnswers += 1;
          }

          this.assessmentQuestionIndexObj.assessmentQuestionIndex += 1;

          if (this.assessmentQuestionIndexObj.assessmentQuestionIndex < this.assessmentQuestionsObj.assessmentQuestions.length) {
            const assessmentQCard = AdaptiveCards.declare<Question>(rawAssessmentquestionsCard).render(this.assessmentQuestionsObj.assessmentQuestions[this.assessmentQuestionIndexObj.assessmentQuestionIndex]);

            await context.updateActivity({
              type: "message",
              id: context.activity.replyToId,
              attachments: [CardFactory.adaptiveCard(assessmentQCard)],
            });
            return { statusCode: 200, type: undefined, value: undefined };
          }
          else {
            const cardData: InformationPanel = {
              title: "Knowledge Quest",
              body: `Your score: ${this.correctAnswersObj.correctAnswers} / ${this.assessmentQuestionsObj.assessmentQuestions.length}. Thank you for choosing Knowledge Quest to challenge and expand your knowledge! We appreciate your dedication to learning and hope Knowledge Quest continues to inspire and entertain you. Knowledge is power! Type 'welcome' to start exploring again.`,
            };

            const informationPanelCard = AdaptiveCards.declare<InformationPanel>(rawInformationPanelCard).render(cardData);
            await context.sendActivity({ attachments: [CardFactory.adaptiveCard(informationPanelCard)] });

            this.assessmentQuestionsObj.assessmentQuestions = null;
            this.assessmentQuestionIndexObj.assessmentQuestionIndex = 0;
            this.correctAnswersObj.correctAnswers = 0;
          }
        }
        break;

      case 'endassessment':
        const cardData: InformationPanel = {
          title: "Knowledge Quest",
          body: `Your score: ${this.correctAnswersObj.correctAnswers} / ${this.assessmentQuestionsObj.assessmentQuestions.length}. Thank you for choosing Knowledge Quest to challenge and expand your knowledge! We appreciate your dedication to learning and hope Knowledge Quest continues to inspire and entertain you. Knowledge is power! Type 'welcome' to start exploring again.`,
        };

        const informationPanelCard = AdaptiveCards.declare<InformationPanel>(rawInformationPanelCard).render(cardData);
        await context.sendActivity({ attachments: [CardFactory.adaptiveCard(informationPanelCard)] });

        this.assessmentQuestionsObj.assessmentQuestions = null;
        this.assessmentQuestionIndexObj.assessmentQuestionIndex = 0;
        this.correctAnswersObj.correctAnswers = 0;

        break;
    }
  }
}
