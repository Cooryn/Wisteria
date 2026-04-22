import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
import { savedIssueToIssue } from '../services/savedIssues';
import RepoCard from '../components/RepoCard';
import IssueCard from '../components/IssueCard';
import type { SavedIssue, ScoreResult } from '../types';

export default function Dashboard() {
  const {
    user,
    languages,
    frameworks,
    tools,
    minStars,
    maxStars,
    issueLabels,
    isHydrated,
    setCurrentPage,
    setSelectedRepo,
    setSelectedIssue,
    setIssueDetailBackPage,
    showNotification,
  } = useAppStore();

  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [recommendedRepos, setRecommendedRepos] = useState<Array<{ repo: any; score: ScoreResult }>>([]);
  const [savedIssues, setSavedIssues] = useState<SavedIssue[]>([]);
  const [stats, setStats] = useState({
    savedRepos: 0,
    savedIssues: 0,
    prCount: 0,
  });

  const savedIssuesSectionRef = useRef<HTMLDivElement | null>(null);

  const hasPreferences = useMemo(
    () => languages.length > 0 || frameworks.length > 0 || tools.length > 0,
    [frameworks.length, languages.length, tools.length]
  );

  const loadDashboardData = useCallback(async () => {
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
      setSavedIssues(issues);
    } catch {
      // Ignore bootstrap-time database races; the next mount will recover.
    }
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const fetchRecommendations = useCallback(async () => {
    if (!isHydrated || !hasPreferences) {
      return;
    }

    setLoadingRecommendations(true);
    try {
      const query = buildSearchQuery({
        languages: languages.map((tag) => tag.name),
        topics: [...frameworks, ...tools].map((tag) => tag.name),
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
          score: scoreRepo(repo, {
            languages,
            frameworks,
            tools,
            minStars,
            maxStars,
            issueLabels,
          }),
        }))
        .sort((a, b) => b.score.total - a.score.total);

      setRecommendedRepos(scored);
    } catch (err) {
      showNotification(`搜索失败: ${err}`, 'error');
    } finally {
      setLoadingRecommendations(false);
    }
  }, [
    frameworks,
    hasPreferences,
    isHydrated,
    issueLabels,
    languages,
    maxStars,
    minStars,
    showNotification,
    tools,
  ]);

  useEffect(() => {
    if (isHydrated) {
      void fetchRecommendations();
    }
  }, [fetchRecommendations, isHydrated]);

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
      gradient: 'linear-gradient(135deg, #0097A7 0%, #4DD0E1 100%)',
      onClick: () => {
        if (savedIssues.length > 0) {
          savedIssuesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      },
    },
    {
      label: '已提交 PR',
      value: stats.prCount,
      icon: <PRIcon />,
      gradient: 'linear-gradient(135deg, #66BB6A 0%, #A5D6A7 100%)',
    },
  ];

  if (!isHydrated) {
    return (
      <Box
        sx={{
          p: 3,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            正在恢复本地设置与登录状态...
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Fade in timeout={600}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            {user ? `欢迎回来，${user.name ?? user.login}` : '欢迎使用 Wisteria'}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {hasPreferences
              ? '这里是根据你的偏好推荐的开源项目与已收藏 Issue。'
              : '请先设置你的技术栈偏好，以便获得更贴近你的推荐。'}
          </Typography>
        </Box>
      </Fade>

      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {statCards.map((card) => (
          <Grid size={{ xs: 12, sm: 4 }} key={card.label}>
            <Fade in timeout={800}>
              <Card
                onClick={card.onClick}
                sx={{
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: card.onClick ? 'pointer' : 'default',
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

      {!hasPreferences && (
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
            开始设置你的技术栈偏好
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            告诉我你擅长哪些语言和框架，我会帮你找到更合适的项目和 Issue。
          </Typography>
          <Button variant="contained" onClick={() => setCurrentPage('preferences')} size="large">
            开始设置
          </Button>
        </Card>
      )}

      {savedIssues.length > 0 && (
        <Box ref={savedIssuesSectionRef} sx={{ mb: 4 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>
              已收藏 Issue
            </Typography>
            <Typography variant="body2" color="text.secondary">
              点击任意 Issue 继续查看详情
            </Typography>
          </Stack>

          <Stack spacing={1.5}>
            {savedIssues.map((savedIssue) => {
              const issue = savedIssueToIssue(savedIssue);
              return (
                <IssueCard
                  key={savedIssue.github_id}
                  issue={issue}
                  onClick={() => {
                    setSelectedIssue(issue);
                    setIssueDetailBackPage('dashboard');
                    setCurrentPage('issue-detail');
                  }}
                />
              );
            })}
          </Stack>
        </Box>
      )}

      {(recommendedRepos.length > 0 || loadingRecommendations) && (
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>
              推荐项目
            </Typography>
            <Button
              startIcon={<RefreshIcon />}
              onClick={fetchRecommendations}
              disabled={loadingRecommendations}
              size="small"
            >
              刷新
            </Button>
          </Stack>

          {loadingRecommendations ? (
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
