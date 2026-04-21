const mongoose = require('mongoose');

const { Schema } = mongoose;

const teamSchema = new Schema(
  {
    teamId: {
      type: Number,
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    logo: {
      type: String,
      default: null,
      trim: true
    },
    winner: {
      type: Boolean,
      default: null
    }
  },
  { _id: false }
);

const roundSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    number: {
      type: Number,
      required: true,
      index: true
    }
  },
  { _id: false }
);

const resultSchema = new Schema(
  {
    homeGoals: {
      type: Number,
      default: null
    },
    awayGoals: {
      type: Number,
      default: null
    },
    display: {
      type: String,
      default: '-'
    },
    statusShort: {
      type: String,
      default: 'NS',
      trim: true
    },
    statusLong: {
      type: String,
      default: 'Not Started',
      trim: true
    },
    tipOutcome: {
      type: String,
      enum: ['pending', 'won', 'lost', 'void'],
      default: 'pending'
    },
    isFinished: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  { _id: false }
);

const tipSchema = new Schema(
  {
    label: {
      type: String,
      default: '-',
      trim: true
    },
    advice: {
      type: String,
      default: null,
      trim: true
    },
    winnerTeamId: {
      type: Number,
      default: null
    },
    winnerName: {
      type: String,
      default: null,
      trim: true
    },
    winOrDraw: {
      type: Boolean,
      default: false
    },
    underOver: {
      type: String,
      default: null,
      trim: true
    },
    goalsLine: {
      home: {
        type: String,
        default: null,
        trim: true
      },
      away: {
        type: String,
        default: null,
        trim: true
      }
    },
    confidence: {
      home: {
        type: String,
        default: null,
        trim: true
      },
      draw: {
        type: String,
        default: null,
        trim: true
      },
      away: {
        type: String,
        default: null,
        trim: true
      }
    },
    fetchedAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

const leaguePredictionSchema = new Schema(
  {
    fixtureId: {
      type: Number,
      required: true,
      unique: true,
      index: true
    },
    leagueId: {
      type: Number,
      required: true,
      index: true
    },
    season: {
      type: Number,
      required: true,
      index: true
    },
    leagueName: {
      type: String,
      required: true,
      trim: true
    },
    country: {
      type: String,
      required: true,
      trim: true
    },
    round: {
      type: roundSchema,
      required: true
    },
    kickoffAt: {
      type: Date,
      required: true,
      index: true
    },
    match: {
      type: String,
      required: true,
      trim: true
    },
    venue: {
      name: {
        type: String,
        default: null,
        trim: true
      },
      city: {
        type: String,
        default: null,
        trim: true
      }
    },
    homeTeam: {
      type: teamSchema,
      required: true
    },
    awayTeam: {
      type: teamSchema,
      required: true
    },
    tip: {
      type: tipSchema,
      default: () => ({})
    },
    result: {
      type: resultSchema,
      default: () => ({})
    }
  },
  {
    collection: 'league_predictions',
    timestamps: true
  }
);

leaguePredictionSchema.index({ leagueId: 1, season: 1, 'round.number': 1, kickoffAt: 1 });
leaguePredictionSchema.index({ leagueId: 1, kickoffAt: 1 });

module.exports = mongoose.model('LeaguePrediction', leaguePredictionSchema);
