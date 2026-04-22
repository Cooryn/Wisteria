import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid2 as Grid,
  CircularProgress,
  Stack,
  IconButton,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Fade,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useAppStore } from '../store';
import { searchRepositories, buildSearchQuery, searchIssues } from '../services/github';
import { scoreRepo, scoreIssue } from '../services/scorer';
import RepoCard from '../components/RepoCard';
import IssueCard from '../components/IssueCard';
import type { Repo, Issue, ScoreResult } from '../types';

function issueMatchesPreferredLabels(issue: Issue, preferredLabels: string[]): boolean {
  if (preferredLabels.length === 0) {
    return true;
  }

  const labelSet = new Set(preferredLabels.map((label) => label.toLowerCase()));
  return issue.labels.some((label) => labelSet.has(label.name.toLowerCase()));
}

export default function Explorer() {
  const {
    languages,
    frameworks,
    tools,
    minStars,
    maxStars,
    issueLabels,
    selectedRepo,
    setSelectedRepo,
    setSelectedIssue,
    setIssueDetailBackPage,
    setCurrentPage,
    showNotification,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [repos, setRepos] = useState<{ repo: Repo; score: ScoreResult }[]>([]);
  const [issues, setIssues] = useState<{ issue: Issue; score: number }[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'stars' | 'updated'>('score');
  const [languageFilter, setLanguageFilter] = useState('');
  const [starsRange, setStarsRange] = useState<number[]>([
    minStars,
    maxStars > 50000 ? 50000 : maxStars,
  ]);

  const prefs = useMemo(
    () => ({
      languages,
      frameworks,
      tools,
      minStars,
      maxStars,
      issueLabels,
    }),
    [languages, frameworks, tools, minStars, maxStars, issueLabels]
  );

  const handleSearch = useCallback(async () => {
    setLoadingRepos(true);
    try {
      let query = searchQuery.trim();
      if (!query) {
        query = buildSearchQuery({
          languages: languages.map((tag) => tag.name),
          topics: [...frameworks, ...tools].map((tag) => tag.name),
          minStars: starsRange[0],
          maxStars: starsRange[1],
        });
      }

      if (languageFilter.trim()) {
        query += ` language:${languageFilter.trim()}`;
      }

      const { items } = await searchRepositories(query, {
        sort: sortBy === 'score' ? 'stars' : sortBy,
        perPage: 30,
      });

      const scored = items
        .map((repo) => ({
          repo,
          score: scoreRepo(repo, prefs),
        }))
        .sort((a, b) => {
          if (sortBy === 'score') return b.score.total - a.score.total;
          if (sortBy === 'stars') return b.repo.stargazers_count - a.repo.stargazers_count;
          return new Date(b.repo.updated_at).getTime() - new Date(a.repo.updated_at).getTime();
        });

      setRepos(scored);
      setSelectedRepo(null);
      setIssues([]);
    } catch (err) {
      showNotification(`搜索失败: ${err}`, 'error');
    } finally {
      setLoadingRepos(false);
    }
  }, [
    searchQuery,
    languages,
    frameworks,
    tools,
    starsRange,
    languageFilter,
    sortBy,
    prefs,
    setSelectedRepo,
    showNotification,
  ]);

  const loadIssuesForRepo = useCallback(
    async (repo: Repo) => {
      setLoadingIssues(true);
      setIssues([]);

      try {
        const repoIssues = await searchIssues(repo.full_name, {
          state: 'open',
          perPage: 50,
        });

        const scored = repoIssues
          .map((issue) => {
            const issueWithRepo = { ...issue, repo_full_name: repo.full_name };
            return {
              issue: issueWithRepo,
              score: scoreIssue(issueWithRepo, issueLabels),
            };
          })
          .sort((a, b) => b.score - a.score);

        if (issueLabels.length === 0) {
          setIssues(scored);
          return;
        }

        const matched = scored.filter(({ issue }) =>
          issueMatchesPreferredLabels(issue, issueLabels)
        );

        if (matched.length > 0) {
          setIssues(matched);
          return;
        }

        setIssues(scored);
        if (scored.length > 0) {
          showNotification(
            '这个仓库没有命中你偏好标签的 Issue，先为你展示最近更新的开放 Issue',
            'info'
          );
        }
      } catch (err) {
        setIssues([]);
        showNotification(`加载 Issue 失败: ${err}`, 'error');
      } finally {
        setLoadingIssues(false);
      }
    },
    [issueLabels, showNotification]
  );

  useEffect(() => {
    if (!selectedRepo) {
      setIssues([]);
      setLoadingIssues(false);
      return;
    }

    void loadIssuesForRepo(selectedRepo);
  }, [selectedRepo, loadIssuesForRepo]);

  const handleSelectRepo = useCallback(
    (repo: Repo) => {
      setLoadingIssues(true);
      setSelectedRepo(repo);
    },
    [setSelectedRepo]
  );

  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            fullWidth
            placeholder="搜索 GitHub 项目，留空则按偏好自动搜索"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            size="small"
          />
          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={loadingRepos}
            sx={{ minWidth: 100 }}
          >
            {loadingRepos ? <CircularProgress size={20} color="inherit" /> : '搜索'}
          </Button>
        </Stack>

        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
          <FilterIcon sx={{ color: 'text.secondary', fontSize: 20 }} />

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>排序方式</InputLabel>
            <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} label="排序方式">
              <MenuItem value="score">匹配度</MenuItem>
              <MenuItem value="stars">Star 数</MenuItem>
              <MenuItem value="updated">最近更新</MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            placeholder="语言过滤"
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            sx={{ width: 140 }}
          />

          <Box sx={{ width: 200 }}>
            <Typography variant="caption" color="text.secondary">
              Star: {starsRange[0].toLocaleString()} - {starsRange[1].toLocaleString()}
            </Typography>
            <Slider
              value={starsRange}
              onChange={(_, value) => setStarsRange(value as number[])}
              min={0}
              max={50000}
              step={100}
              size="small"
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${(value / 1000).toFixed(1)}k`}
            />
          </Box>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', gap: 3, overflow: 'hidden', minWidth: 0 }}>
        <Box
          sx={{
            flex: selectedRepo ? '0 1 44%' : '1 1 100%',
            minWidth: 0,
            overflow: 'auto',
            transition: 'flex-basis 0.3s ease',
            pr: selectedRepo ? 1 : 0,
            scrollbarGutter: 'stable',
          }}
        >
          {loadingRepos ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : repos.length > 0 ? (
            <Grid container spacing={2}>
              {repos.map(({ repo, score }) => (
                <Grid size={{ xs: 12, sm: selectedRepo ? 12 : 6, md: selectedRepo ? 12 : 4 }} key={repo.id}>
                  <Fade in timeout={400}>
                    <Box>
                      <RepoCard repo={repo} score={score} onClick={() => handleSelectRepo(repo)} />
                    </Box>
                  </Fade>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                opacity: 0.5,
              }}
            >
              <SearchIcon sx={{ fontSize: 64, mb: 2 }} />
              <Typography variant="h6">开始搜索项目</Typography>
              <Typography variant="body2" color="text.secondary">
                输入关键词，或者直接使用你的偏好自动筛选
              </Typography>
            </Box>
          )}
        </Box>

        {selectedRepo && (
          <Fade in timeout={400}>
            <Box
              sx={{
                flex: '1 1 0',
                minWidth: 0,
                borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
                pl: 3,
                pr: 1,
                overflow: 'auto',
                scrollbarGutter: 'stable',
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    {selectedRepo.full_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    开放 Issue 列表
                  </Typography>
                </Box>
                <IconButton
                  aria-label="close issue list"
                  size="small"
                  onClick={() => {
                    setSelectedRepo(null);
                    setIssues([]);
                  }}
                  sx={{
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    color: 'text.secondary',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                      color: 'text.primary',
                    },
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>

              <Divider sx={{ mb: 2 }} />

              {loadingIssues ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress />
                </Box>
              ) : issues.length > 0 ? (
                issues.map(({ issue, score }) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    score={score}
                    onClick={() => {
                      setSelectedIssue(issue);
                      setIssueDetailBackPage('explorer');
                      setCurrentPage('issue-detail');
                    }}
                  />
                ))
              ) : (
                <Box sx={{ textAlign: 'center', py: 4, opacity: 0.5 }}>
                  <Typography>暂无可用的 Issue</Typography>
                  <Typography variant="caption" color="text.secondary">
                    这个仓库当前没有获取到开放 Issue，或者 GitHub 暂时没有返回结果
                  </Typography>
                </Box>
              )}
            </Box>
          </Fade>
        )}
      </Box>
    </Box>
  );
}
