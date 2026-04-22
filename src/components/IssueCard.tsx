import {
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Box,
  Chip,
  Stack,
} from '@mui/material';
import {
  ChatBubbleOutlined as CommentIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import type { Issue } from '../types';
import ScoreBadge from './ScoreBadge';

interface IssueCardProps {
  issue: Issue;
  score?: number;
  onClick?: () => void;
}

export default function IssueCard({ issue, score, onClick }: IssueCardProps) {
  return (
    <Card sx={{ mb: 1.5 }}>
      <CardActionArea onClick={onClick}>
        <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            {/* Main content */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {/* Title */}
              <Typography
                variant="subtitle1"
                fontWeight={600}
                sx={{
                  mb: 0.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                #{issue.number} {issue.title}
              </Typography>

              {/* Repo name if available */}
              {issue.repo_full_name && (
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  {issue.repo_full_name}
                </Typography>
              )}

              {/* Labels */}
              <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
                {issue.labels.slice(0, 5).map((label) => (
                  <Chip
                    key={label.id}
                    label={label.name}
                    size="small"
                    sx={{
                      fontSize: '0.7rem',
                      height: 22,
                      backgroundColor: `#${label.color}22`,
                      color: `#${label.color}`,
                      border: `1px solid #${label.color}44`,
                      fontWeight: 500,
                    }}
                  />
                ))}
              </Stack>

              {/* Meta info */}
              <Stack direction="row" spacing={2} alignItems="center">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CommentIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {issue.comments} 评论
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {formatTimeAgo(issue.updated_at)}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  by {issue.user.login}
                </Typography>
              </Stack>
            </Box>

            {/* Score */}
            {score !== undefined && (
              <Box sx={{ flexShrink: 0 }}>
                <ScoreBadge score={score} size="small" showLabel={false} />
              </Box>
            )}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 30) return `${diffDay} 天前`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)} 月前`;
  return `${Math.floor(diffDay / 365)} 年前`;
}
