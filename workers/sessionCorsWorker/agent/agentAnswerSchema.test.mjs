import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentQuestionAnswerSchema } from './agentAnswerSchema.mjs';

// Captured from the retained HTTP schema contract before transport removal.
const cases = [
  {
    "question": {},
    "expected": {
      "questionType": "freeform",
      "answerSchema": {
        "kind": "text",
        "maxChars": 280
      }
    }
  },
  {
    "question": {
      "type": "text"
    },
    "expected": {
      "questionType": "freeform",
      "answerSchema": {
        "kind": "text",
        "maxChars": 280
      }
    }
  },
  {
    "question": {
      "type": "binary"
    },
    "expected": {
      "questionType": "binary",
      "answerSchema": {
        "kind": "choice",
        "values": [
          "agree",
          "disagree",
          "unsure"
        ]
      }
    }
  },
  {
    "question": {
      "type": "yes-no"
    },
    "expected": {
      "questionType": "binary",
      "answerSchema": {
        "kind": "choice",
        "values": [
          "agree",
          "disagree",
          "unsure"
        ]
      }
    }
  },
  {
    "question": {
      "type": "rating"
    },
    "expected": {
      "questionType": "rating",
      "answerSchema": {
        "kind": "rating",
        "min": 0,
        "max": 10,
        "step": 1,
        "values": [
          0,
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10
        ]
      }
    }
  },
  {
    "question": {
      "type": "rating",
      "scale": {
        "min": 1,
        "max": 10,
        "step": 3
      }
    },
    "expected": {
      "questionType": "rating",
      "answerSchema": {
        "kind": "rating",
        "min": 1,
        "max": 10,
        "step": 3,
        "values": [
          1,
          4,
          7,
          10
        ]
      }
    }
  },
  {
    "question": {
      "type": "rating",
      "scale": {
        "min": -0.5,
        "max": 0.5,
        "step": 0.1
      }
    },
    "expected": {
      "questionType": "rating",
      "answerSchema": {
        "kind": "rating",
        "min": -0.5,
        "max": 0.5,
        "step": 0.1,
        "values": [
          -0.5,
          -0.4,
          -0.3,
          -0.2,
          -0.1,
          0,
          0.1,
          0.2,
          0.3,
          0.4,
          0.5
        ]
      }
    }
  },
  {
    "question": {
      "type": "rating",
      "scale": {
        "min": 0,
        "max": 100,
        "step": 1
      }
    },
    "expected": {
      "questionType": "rating",
      "answerSchema": {
        "kind": "rating",
        "min": 0,
        "max": 100,
        "step": 1,
        "values": [
          0,
          5,
          10,
          15,
          20,
          25,
          30,
          35,
          40,
          45,
          50,
          55,
          60,
          65,
          70,
          75,
          80,
          85,
          90,
          95,
          100
        ]
      }
    }
  },
  {
    "question": {
      "type": "rating",
      "scale": {
        "step": 2
      },
      "ratingScale": {
        "min": 0,
        "max": 10,
        "step": 5
      }
    },
    "expected": {
      "questionType": "rating",
      "answerSchema": {
        "kind": "rating",
        "min": 0,
        "max": 10,
        "step": 5,
        "values": [
          0,
          5,
          10
        ]
      }
    }
  },
  {
    "question": {
      "type": "multichoice",
      "options": [
        "A",
        "B",
        "A",
        "",
        {
          "label": " C "
        },
        {
          "text": "D"
        }
      ]
    },
    "expected": {
      "questionType": "multichoice",
      "answerSchema": {
        "kind": "multichoice",
        "options": [
          "A",
          "B",
          "C",
          "D"
        ],
        "minSelections": 1,
        "maxSelections": 4,
        "selectionMode": "multi"
      }
    }
  },
  {
    "question": {
      "type": "single_choice",
      "options": [
        "A",
        "B"
      ]
    },
    "expected": {
      "questionType": "multichoice",
      "answerSchema": {
        "kind": "multichoice",
        "options": [
          "A",
          "B"
        ],
        "minSelections": 1,
        "maxSelections": 1,
        "selectionMode": "single"
      }
    }
  },
  {
    "question": {
      "type": "multi_choice",
      "singleSelect": true,
      "options": [
        "A",
        "B"
      ]
    },
    "expected": {
      "questionType": "multichoice",
      "answerSchema": {
        "kind": "multichoice",
        "options": [
          "A",
          "B"
        ],
        "minSelections": 1,
        "maxSelections": 1,
        "selectionMode": "single"
      }
    }
  },
  {
    "question": {
      "type": "quadratic",
      "options": [
        "A",
        "B"
      ],
      "voiceCredits": 25
    },
    "expected": {
      "questionType": "quadratic",
      "answerSchema": {
        "kind": "quadratic",
        "options": [
          "A",
          "B"
        ],
        "voiceCredits": 25
      }
    }
  },
  {
    "question": {
      "type": "quadratic",
      "options": [
        "A",
        "B"
      ]
    },
    "expected": {
      "questionType": "quadratic",
      "answerSchema": {
        "kind": "quadratic",
        "options": [
          "A",
          "B"
        ],
        "voiceCredits": 99
      }
    }
  },
  {
    "question": {
      "type": "unknown"
    },
    "expected": {
      "questionType": "freeform",
      "answerSchema": {
        "kind": "text",
        "maxChars": 280
      }
    }
  }
];

for (const [index, {question, expected}] of cases.entries()) {
  test(`HTTP answer schema preserves stored metadata and type aliases: ${index}`, () => {
    assert.deepEqual(buildAgentQuestionAnswerSchema(question), expected);
  });
}
