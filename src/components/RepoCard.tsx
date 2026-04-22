import {
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Box,
  Chip,
  Avatar,
  Stack,
  alpha,
} from '@mui/material';
import {
  Star as StarIcon,
  CallSplit as ForkIcon,
  BugReport as IssueIcon,
} from '@mui/icons-material';
import type { Repo, ScoreResult } from '../types';
import ScoreBadge from './ScoreBadge';

interface RepoCardProps {
  repo: Repo;
  score?: ScoreResult;
  onClick?: () => void;
}

export default function RepoCard({ repo, score, onClick }: RepoCardProps) {
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CardActionArea onClick={onClick} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Header: Avatar + Name + Score */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
            <Avatar
              src={repo.owner.avatar_url}
              alt={repo.owner.login}
              sx={{ width: 36, height: 36, mt: 0.3 }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                fontWeight={700}
                noWrap
                sx={{ lineHeight: 1.3 }}
              >
                {repo.name}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
              >
                {repo.owner.login}
              </Typography>
            </Box>
            {score && <ScoreBadge score={score.total} size="small" showLabel={false} />}
          </Box>

          {/* Description */}
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              flex: 1,
              mb: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.5,
            }}
          >
            {repo.description ?? '暂无描述'}
          </Typography>

          {/* Topics */}
          {repo.topics && repo.topics.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
              {repo.topics.slice(0, 4).map((topic) => (
                <Chip
                  key={topic}
                  label={topic}
                  size="small"
                  variant="outlined"
                  sx={{
                    fontSize: '0.7rem',
                    height: 22,
                    borderColor: (theme) => alpha(theme.palette.primary.main, 0.3),
                    color: 'primary.main',
                  }}
                />
              ))}
              {repo.topics.length > 4 && (
                <Chip
                  label={`+${repo.topics.length - 4}`}
                  size="small"
                  sx={{
                    fontSize: '0.7rem',
                    height: 22,
                    backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  }}
                />
              )}
            </Stack>
          )}

          {/* Stats Bar */}
          <Stack direction="row" spacing={2} alignItems="center">
            {repo.language && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: getLanguageColor(repo.language),
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  {repo.language}
                </Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <StarIcon sx={{ fontSize: 14, color: '#FFA726' }} />
              <Typography variant="caption" color="text.secondary">
                {formatNumber(repo.stargazers_count)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <ForkIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {formatNumber(repo.forks_count)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <IssueIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {repo.open_issues_count}
              </Typography>
            </Box>
          </Stack>

          {/* Score recommendation */}
          {score && score.recommendation && (
            <Typography
              variant="caption"
              sx={{
                mt: 1.5,
                p: 1,
                borderRadius: 1.5,
                backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.06),
                color: 'text.secondary',
                lineHeight: 1.5,
              }}
            >
              {score.recommendation}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

// ---- Helpers ----
function formatNumber(num: number): string {
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
}

function getLanguageColor(lang: string): string {
  const colors: Record<string, string> = {
    TypeScript: '#3178C6',
    JavaScript: '#F7DF1E',
    Python: '#3776AB',
    Rust: '#DEA584',
    Go: '#00ADD8',
    Java: '#B07219',
    'C++': '#F34B7D',
    C: '#555555',
    'C#': '#239120',
    Ruby: '#CC342D',
    PHP: '#4F5D95',
    Swift: '#FA7343',
    Kotlin: '#A97BFF',
    Dart: '#00B4AB',
    Vue: '#41B883',
    HTML: '#E34F26',
    CSS: '#1572B6',
    Shell: '#89E051',
    Lua: '#000080',
    Scala: '#DC322F',
    Elixir: '#6E4A7E',
    Haskell: '#5D4F85',
  };
  return colors[lang] ?? '#7C4DFF';
}
