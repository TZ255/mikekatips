const mongoose = require('mongoose');

const { Schema } = mongoose;

const standingRowSchema = new Schema(
  {
    rank: Number,
    teamId: Number,
    teamName: String,
    teamLogo: String,
    points: Number,
    played: Number,
    won: Number,
    drawn: Number,
    lost: Number,
    goalsFor: Number,
    goalsAgainst: Number,
    goalDifference: Number,
    form: String,
    description: String
  },
  { _id: false }
);

const roundSchema = new Schema(
  {
    name: {
      type: String,
      default: null
    },
    number: {
      type: Number,
      default: null
    },
    updatedAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

const leagueSchema = new Schema(
  {
    leagueId: {
      type: Number,
      required: true,
      unique: true,
      index: true
    },
    season: {
      type: Number,
      required: true,
      index: true
    },
    seasonLabel: {
      type: String,
      default: null,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    country: {
      type: String,
      required: true,
      trim: true
    },
    countryCode: {
      type: String,
      default: null,
      trim: true
    },
    countryFlag: {
      type: String,
      default: null,
      trim: true
    },
    logo: {
      type: String,
      default: null,
      trim: true
    },
    type: {
      type: String,
      default: 'League',
      trim: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    displayOrder: {
      type: Number,
      default: 0
    },
    rounds: {
      current: {
        type: roundSchema,
        default: () => ({})
      },
      next: {
        type: roundSchema,
        default: () => ({})
      },
      latestCompleted: {
        type: roundSchema,
        default: () => ({})
      }
    },
    standings: {
      updatedAt: {
        type: Date,
        default: null
      },
      rows: {
        type: [standingRowSchema],
        default: []
      }
    },
    sync: {
      lastSuccessfulSyncAt: {
        type: Date,
        default: null
      },
      lastAttemptAt: {
        type: Date,
        default: null
      },
      lastError: {
        type: String,
        default: null
      }
    }
  },
  {
    collection: 'leagues',
    timestamps: true
  }
);

leagueSchema.index({ isActive: 1, displayOrder: 1, name: 1 });

module.exports = mongoose.model('League', leagueSchema);
