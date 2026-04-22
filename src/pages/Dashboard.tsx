import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid2 as Grid,
  Card,
  CardContent,
  CircularProgress,
  Button,
  Stack,
  alpha,
  Fade,
} from '@mui/material';
import {
  Explore as ExploreIcon,
  Bookmark as BookmarkIcon,
  CallMerge as PRIcon,
  TrendingUp as TrendingIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAppStore } from '../store';
import { searchRepositories, buildSearchQuery } from '../services/github';
import { scoreRepo } from '../services/scorer';
import { getSavedRepos, getSavedIssues, getPRHistory } from '../services/database';
import RepoCard from '../components/RepoCard';
import type { ScoreResult } from '../types';

export default function Dashboard() {
  const {
    user,
    languages,
    frameworks,
    tools,
    minStars,
    maxStars,
    issueLabels,
    setCurrentPage,
    setSelectedRepo,
    showNotification,
  } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [recommendedRepos, setRecommendedRepos] = useState<
    { repo: any; score: ScoreResult }[]
  >([]);
  const [stats, setStats] = useState({
    savedRepos: 0,
    savedIssues: 0,
    prCount: 0,
  });

  // Load stats from DB
  useEffect(() => {
    (async () => {
      try {
        const [repos, issues, prs] = await Promise.all([
          getSavedRepos(),
          getSavedIssues(),
          getPRHistory(),
        ]);
        setStats({
          savedRepos: repos.length,
          savedIssues: issues.length,
          prCount: prs.length,
        });
      } catch {
        // DB not ready yet
      }
    })();
  }, []);

  const fetchRecommendations = useCallback(async () => {
    if (languages.length === 0 && frameworks.length === 0 && tools.length === 0) return;

    setLoading(true);
    try {
      const query = buildSearchQuery({
        languages: languages.map((t) => t.name),
        topics: [...frameworks, ...tools].map((t) => t.name),
        minStars,
        maxStars,
      });

      const { items } = await searchRepositories(query, {
        sort: 'updated',
        perPage: 12,
      });

      const scored = items
        .map((repo) => ({
          repo,
          score: scoreRepo(repo, { languages, frameworks, tools, minStars, maxStars, issueLabels }),
        }))
        .sort((a, b) => b.score.total - a.score.total);

      setRecommendedRepos(scored);
    } catch (err) {
      showNotification(`搜索失败: ${err}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [languages, frameworks, tools, minStars, maxStars, issueLabels, showNotification]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const statCards = [
    {
      label: '已分析项目',
      value: stats.savedRepos,
      icon: <ExploreIcon />,
      gradient: 'linear-gradient(135deg, #7C4DFF 0%, #B388FF 100%)',
    },
    {
      label: '收藏 Issue',
      value: stats.savedIssues,
      icon: <BookmarkIcon />,
      gradient: 'linear-gradient(135deg, #00E5FF 0%, #6EFFFF 100%)',
    },
    {
      label: '已提交 PR',
      value: stats.prCount,
      icon: <PRIcon />,
      gradient: 'linear-gradient(135deg, #66BB6A 0%, #A5D6A7 100%)',
    },
  ];

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      {/* Welcome */}
      <Fade in timeout={600}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            {user ? `欢迎回来，${user.name ?? user.login}` : '欢迎使用 Wisteria'}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {languages.length > 0
              ? '以下是根据你的偏好推荐的开源项目。'
              : '请先设置你的技术栈偏好，以获取个性化推荐。'}
          </Typography>
        </Box>
      </Fade>

      {/* Stat Cards */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {statCards.map((card) => (
          <Grid size={{ xs: 12, sm: 4 }} key={card.label}>
            <Fade in timeout={800}>
              <Card
                sx={{
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: card.gradient,
                  },
                }}
              >
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: card.gradient,
                      color: '#fff',
                    }}
                  >
                    {card.icon}
                  </Box>
                  <Box>
                    <Typography variant="h4" fontWeight={700}>
                      {card.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {card.label}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Fade>
          </Grid>
        ))}
      </Grid>

      {/* Action buttons if no preferences */}
      {languages.length === 0 && frameworks.length === 0 && (
        <Card
          sx={{
            mb: 4,
            p: 4,
            textAlign: 'center',
            background: (theme) =>
              `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
          }}
        >
          <TrendingIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            设置你的技术栈偏好
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            告诉我你擅长哪些编程语言和框架，我会帮你找到最合适的开源项目。
          </Typography>
          <Button
            variant="contained"
            onClick={() => setCurrentPage('preferences')}
            size="large"
          >
            开始设置
          </Button>
        </Card>
      )}

      {/* Recommended Repos */}
      {(recommendedRepos.length > 0 || loading) && (
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>
              🌸 推荐项目
            </Typography>
            <Button
              startIcon={<RefreshIcon />}
              onClick={fetchRecommendations}
              disabled={loading}
              size="small"
            >
              刷新
            </Button>
          </Stack>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={2}>
              {recommendedRepos.map(({ repo, score }) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={repo.id}>
                  <Fade in timeout={500}>
                    <Box>
                      <RepoCard
                        repo={repo}
                        score={score}
                        onClick={() => {
                          setSelectedRepo(repo);
                          setCurrentPage('explorer');
                        }}
                      />
                    </Box>
                  </Fade>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}
    </Box>
  );
}
