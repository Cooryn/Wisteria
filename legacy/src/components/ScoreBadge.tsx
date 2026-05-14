import { Box, Typography, Chip, alpha } from '@mui/material';
import { getScoreColor, getScoreLabel } from '../services/scorer';

interface ScoreBadgeProps {
  score: number;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export default function ScoreBadge({ score, size = 'medium', showLabel = true }: ScoreBadgeProps) {
  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  const dimensions = {
    small: { size: 36, fontSize: '0.75rem' },
    medium: { size: 48, fontSize: '0.9rem' },
    large: { size: 64, fontSize: '1.2rem' },
  }[size];

  if (!showLabel) {
    return (
      <Chip
        label={`${score}分`}
        size="small"
        sx={{
          backgroundColor: alpha(color, 0.15),
          color,
          fontWeight: 600,
          borderRadius: 2,
          border: `1px solid ${alpha(color, 0.3)}`,
        }}
      />
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        sx={{
          width: dimensions.size,
          height: dimensions.size,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `conic-gradient(${color} ${score * 3.6}deg, ${alpha(color, 0.1)} 0deg)`,
          position: 'relative',
          '&::after': {
            content: '""',
            position: 'absolute',
            width: dimensions.size - 6,
            height: dimensions.size - 6,
            borderRadius: '50%',
            backgroundColor: 'background.paper',
          },
        }}
      >
        <Typography
          sx={{
            fontSize: dimensions.fontSize,
            fontWeight: 700,
            color,
            zIndex: 1,
          }}
        >
          {score}
        </Typography>
      </Box>
      <Typography
        variant="caption"
        sx={{ color, fontWeight: 600 }}
      >
        {label}
      </Typography>
    </Box>
  );
}
