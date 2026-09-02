package chatbot

import (
	"bytes"
	"context"
	"fmt"
	"encoding/json"
	"io"
	"net/http"
)

const groqAPIURL = "https://api.groq.com/openai/v1/chat/completions"

type Service struct {
	apiKey string
	httpClient *http.Client
}

type groqMessage struct{
	Role string `json:"role"`
	Content string `json:"content"`
}

type groqRequest struct{
	Model string `json:"model"`
	Messages []groqMessage `json:"messages"`
}

type groqResponse struct{
	Choices []struct{
		Message groqMessage `json:"message"`
	} `json:"choices"`
}

const saturnaliaSystemPrompt = `You are the official AI assistant for Saturnalia'26, the annual techno-cultural festival of Thapar Institute of Engineering and Technology (TIET).

Your job is to answer ONLY questions related to Saturnalia'26 using the information provided below.

Rules:
- Answer only questions related to Saturnalia'26.
- If the user's question is covered by the provided FAQ, answer naturally using that information.
- If the question is about Saturnalia but the information is not available, politely respond:
  "I don't have that information yet. Please check the official Saturnalia website or contact the organizing team for the latest updates."
- If the question is unrelated to Saturnalia (for example programming, math, history, general knowledge, politics, etc.), politely respond:
  "I'm the official Saturnalia'26 assistant, so I can only answer questions related to Saturnalia'26."
- Do not make up information.
- Do not guess dates, pricing, schedules, contacts, or event details.
- Keep responses friendly, concise, and conversational (2-4 sentences maximum).
- **FALLBACK RULE:** If you are unable to generate a proper response, or if the user's input is entirely garbled and confusing, politely respond:
  "I am currently facing a heavy load or experiencing technical difficulties. Please try again later."

FAQ:

Q: What ways can students contribute to Saturnalia'26?
A: Students can contribute by participating in various events and inviting their friends from other colleges to help make the festival a success.

Q: Is there any accommodation provided for participants from outside colleges, and if so, what is the cost?
A: Yes, we do provide accommodation for participants from outside colleges. Check the pricing policy for more information.

Q: How many events and pre-events are scheduled for Saturnalia'26?
A: Saturnalia is a three-day festival, preceded by a week of pre-events and various public engagement activities.

Q: Who can participate in the college fest? Is it open to students from other colleges?
A: All Thapar students and students from other colleges can participate in the fest.

Q: When will Saturnalia 2026 take place?
A: Saturnalia is set to take place from November 21st to 23rd, 2026.

Q: Can I participate in multiple events or competitions during the fest?
A: Yes, you can participate in multiple events or competitions during the fest.

Q: How can I register for the events of Saturnalia'26?
A: You can register for the college fest through our app or website.

Q: How can I stay updated with fest-related announcements and changes?
A: You can stay updated through our Instagram handle, official website, and the Saturnalia 26 app.

Q: What transportation options are available for getting to the fest location?
A: TIET is situated in Patiala, Punjab, and is well connected by air, rail, and road. Participants must make their own travel arrangements, as transportation is not provided.

Q: Is there an entry fee to participate, and if so, how much is it?
A: Yes, there is an entry fee for non-Thapar students. Please check the pricing policy of the specific event for detailed fee information.

Q: What is the location of Saturnalia 2026?
A: Saturnalia 2026 will be held at Thapar Institute of Engineering and Technology (TIET), Patiala, Punjab, India.

Q: Are there any restrictions on the number of participants from each outside college?
A: No. There is no restriction on the number of participants from any outside college.

Q: Do I need to bring any specific documents or student ID from my college?
A: Yes. You need to carry your college ID card or another valid student ID proof for verification purposes.`

func NewService(apiKey string) *Service {
	return &Service{
		apiKey: apiKey,
		httpClient: &http.Client{},
	}
}

func (s *Service) AskGroq(ctx context.Context, message string) (string, error) {
	requestBody := groqRequest{
		Model: "llama-3.3-70b-versatile",
		Messages: []groqMessage{
			{
				Role:    "system",
				Content: saturnaliaSystemPrompt,
			},
			{
				Role:    "user",
				Content: message,
			},
		},
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		groqAPIURL,
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to call Groq API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)

		return "", fmt.Errorf(
			"Groq API returned status %d: %s",
			resp.StatusCode,
			string(body),
		)
	}

	var groqResp groqResponse

	if err := json.NewDecoder(resp.Body).Decode(&groqResp); err != nil {
		return "", fmt.Errorf("failed to decode Groq response: %w", err)
	}

	if len(groqResp.Choices) == 0 {
		return "", fmt.Errorf("no response generated by Groq")
	}

	return groqResp.Choices[0].Message.Content, nil
}