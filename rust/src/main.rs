use eframe::egui;
use rand::seq::SliceRandom;
use rand::Rng;
use std::time::{ Duration, Instant };

// Constants
const EMPTY: u8 = 0;
const AGENT_A: u8 = 1; // Red
const AGENT_B: u8 = 2; // Blue

const STOP_AFTER_ROUNDS: u32 = 20;

struct AgentPos {
    x: usize,
    y: usize,
    agent_type: u8,
}

struct Spot {
    x: usize,
    y: usize,
}

struct SchellingApp {
    // State
    grid: Vec<Vec<u8>>,
    is_running: bool,
    current_round: u32,
    satisfied_percent: f32,
    consecutive_identical_rounds: u32,
    last_step_time: Instant,

    // Params
    param_t: u32,
    param_stop_threshold: u32,
    param_size: usize,
    param_ratio: u32,
    param_empty: u32,
    param_speed: u32,
}

impl Default for SchellingApp {
    fn default() -> Self {
        let mut app = Self {
            grid: Vec::new(),
            is_running: false,
            current_round: 0,
            satisfied_percent: 0.0,
            consecutive_identical_rounds: 0,
            last_step_time: Instant::now(),

            param_t: 50,
            param_stop_threshold: 98,
            param_size: 50,
            param_ratio: 50,
            param_empty: 10,
            param_speed: 950,
        };
        app.reset_simulation();
        app
    }
}

impl SchellingApp {
    fn reset_simulation(&mut self) {
        self.stop_simulation(false);
        self.current_round = 0;
        self.consecutive_identical_rounds = 0;

        let mut rng = rand::thread_rng();
        let ratio = (self.param_ratio as f32) / 100.0;
        let empty_perc = (self.param_empty as f32) / 100.0;

        self.grid = vec![vec![EMPTY; self.param_size]; self.param_size];

        for y in 0..self.param_size {
            for x in 0..self.param_size {
                let rand_val: f32 = rng.r#gen();
                if rand_val < empty_perc {
                    self.grid[y][x] = EMPTY;
                } else {
                    let type_rand: f32 = rng.r#gen();
                    self.grid[y][x] = if type_rand < ratio { AGENT_A } else { AGENT_B };
                }
            }
        }

        self.calculate_stats();
    }

    fn start_simulation(&mut self) {
        if self.is_running {
            return;
        }
        self.is_running = true;
        self.last_step_time = Instant::now();
    }

    fn stop_simulation(&mut self, _finished: bool) {
        self.is_running = false;
    }

    fn step(&mut self) -> (usize, usize) {
        self.current_round += 1;
        let mut unsatisfied_agents = Vec::new();
        let mut empty_spots = Vec::new();

        for y in 0..self.param_size {
            for x in 0..self.param_size {
                let agent = self.grid[y][x];
                if agent == EMPTY {
                    empty_spots.push(Spot { x, y });
                } else if !self.is_satisfied(x, y, agent) {
                    unsatisfied_agents.push(AgentPos { x, y, agent_type: agent });
                }
            }
        }

        if unsatisfied_agents.is_empty() {
            self.calculate_stats();
            return (0, 0);
        }

        let mut rng = rand::thread_rng();
        unsatisfied_agents.shuffle(&mut rng);

        let mut moved_count = 0;

        for agent_obj in unsatisfied_agents.iter() {
            let mut satisfactory_spots = Vec::new();
            let mut best_spot = None;
            let mut max_ratio = -1.0;

            for (j, spot) in empty_spots.iter().enumerate() {
                self.grid[spot.y][spot.x] = agent_obj.agent_type;
                let (same, total) = self.get_neighbor_stats(spot.x, spot.y, agent_obj.agent_type);
                self.grid[spot.y][spot.x] = EMPTY;

                let ratio = if total == 0 { 1.0 } else { (same as f32) / (total as f32) };
                let is_happy = ratio * 100.0 >= (self.param_t as f32);

                if is_happy {
                    satisfactory_spots.push(j);
                }

                if ratio > max_ratio {
                    max_ratio = ratio;
                    best_spot = Some(j);
                } else if (ratio - max_ratio).abs() < f32::EPSILON {
                    if rng.r#gen::<f32>() < 0.5 {
                        best_spot = Some(j);
                    }
                }
            }

            let mut target_index = None;

            if !satisfactory_spots.is_empty() {
                let rand_idx = rng.gen_range(0..satisfactory_spots.len());
                target_index = Some(satisfactory_spots[rand_idx]);
            } else if best_spot.is_some() && max_ratio >= 0.0 {
                target_index = best_spot;
            } else if !empty_spots.is_empty() {
                target_index = Some(rng.gen_range(0..empty_spots.len()));
            }

            if let Some(idx) = target_index {
                let target_spot = &empty_spots[idx];
                self.grid[agent_obj.y][agent_obj.x] = EMPTY;
                self.grid[target_spot.y][target_spot.x] = agent_obj.agent_type;

                empty_spots.remove(idx);
                empty_spots.push(Spot { x: agent_obj.x, y: agent_obj.y });

                moved_count += 1;
            }
        }

        self.calculate_stats();
        (moved_count, unsatisfied_agents.len())
    }

    fn loop_step(&mut self) {
        if !self.is_running {
            return;
        }

        let delay_ms = (1000u64).saturating_sub(self.param_speed as u64);
        if self.last_step_time.elapsed() < Duration::from_millis(delay_ms) {
            return;
        }
        self.last_step_time = Instant::now();

        let (moved, unsatisfied) = self.step();

        if unsatisfied == 0 || moved == 0 {
            self.stop_simulation(true);
            return;
        }

        if self.satisfied_percent >= (self.param_stop_threshold as f32) {
            self.consecutive_identical_rounds += 1;
        } else {
            self.consecutive_identical_rounds = 0;
        }

        if self.consecutive_identical_rounds >= STOP_AFTER_ROUNDS {
            self.stop_simulation(true);
        }
    }

    fn get_neighbor_stats(&self, x: usize, y: usize, agent_type: u8) -> (u32, u32) {
        let mut same = 0;
        let mut total = 0;

        for dy in -1..=1 {
            for dx in -1..=1 {
                if dx == 0 && dy == 0 {
                    continue;
                }

                let nx = (x as i32) + dx;
                let ny = (y as i32) + dy;

                if
                    nx >= 0 &&
                    nx < (self.param_size as i32) &&
                    ny >= 0 &&
                    ny < (self.param_size as i32)
                {
                    let neighbor = self.grid[ny as usize][nx as usize];
                    if neighbor != EMPTY {
                        total += 1;
                        if neighbor == agent_type {
                            same += 1;
                        }
                    }
                }
            }
        }
        (same, total)
    }

    fn is_satisfied(&self, x: usize, y: usize, agent_type: u8) -> bool {
        let (same, total) = self.get_neighbor_stats(x, y, agent_type);
        if total == 0 {
            return true;
        }
        let ratio = ((same as f32) / (total as f32)) * 100.0;
        ratio >= (self.param_t as f32)
    }

    fn calculate_stats(&mut self) {
        let mut total_agents = 0;
        let mut satisfied_agents = 0;

        for y in 0..self.param_size {
            for x in 0..self.param_size {
                let agent = self.grid[y][x];
                if agent != EMPTY {
                    total_agents += 1;
                    if self.is_satisfied(x, y, agent) {
                        satisfied_agents += 1;
                    }
                }
            }
        }

        self.satisfied_percent = if total_agents == 0 {
            0.0
        } else {
            (((satisfied_agents as f32) / (total_agents as f32)) * 100.0 * 10.0).round() / 10.0
        };
    }
}

impl eframe::App for SchellingApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        self.loop_step();

        if self.is_running {
            ctx.request_repaint();
        }

        egui::TopBottomPanel::top("header").show(ctx, |ui| {
            ui.add_space(10.0);
            ui.heading("Schelling's Model of Segregation");
            ui.label(
                "Agents (Red/Blue) move to a random empty spot if they do not have enough neighbors of their own type."
            );
            ui.add_space(10.0);
        });

        egui::SidePanel
            ::right("controls")
            .min_width(250.0)
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    ui.label(format!("Rounds: {}", self.current_round));
                    ui.label(format!("Satisfied: {}%", self.satisfied_percent));
                });

                ui.add_space(10.0);

                ui.horizontal(|ui| {
                    let rounded_percent = ((self.satisfied_percent * 100.0).round() / 100.0) as u32;
                    if
                        ui
                            .add_enabled(
                                !self.is_running && rounded_percent < self.param_stop_threshold,
                                egui::Button::new("Start")
                            )
                            .clicked()
                    {
                        self.start_simulation();
                    }
                    if ui.add_enabled(self.is_running, egui::Button::new("Stop")).clicked() {
                        self.stop_simulation(false);
                    }
                    if
                        ui
                            .add_enabled(
                                !self.is_running && rounded_percent < self.param_stop_threshold,
                                egui::Button::new("Step")
                            )
                            .clicked()
                    {
                        self.step();
                    }
                    if ui.button("Reset").clicked() {
                        self.reset_simulation();
                    }
                });

                ui.add_space(20.0);

                ui.add_enabled_ui(!self.is_running, |ui| {
                    ui.spacing_mut().slider_width = 200.0;

                    ui.label("Threshold (t)");
                    ui.add(egui::Slider::new(&mut self.param_t, 0..=100));

                    ui.label("Stop Threshold (%)");
                    ui.add(egui::Slider::new(&mut self.param_stop_threshold, 0..=100));

                    ui.label("Grid Size (N x N)");
                    if ui.add(egui::Slider::new(&mut self.param_size, 10..=300)).changed() {
                        self.reset_simulation();
                    }

                    ui.label("Type Ratio (Red/Blue)");
                    ui.add(egui::Slider::new(&mut self.param_ratio, 10..=90));

                    ui.label("Empty Cells (%)");
                    ui.add(egui::Slider::new(&mut self.param_empty, 1..=90));
                });

                ui.label("Speed:");
                ui.add(egui::Slider::new(&mut self.param_speed, 0..=1000));
            });

        egui::CentralPanel::default().show(ctx, |ui| {
            let available_size = ui.available_size();
            let canvas_size = available_size.x.min(available_size.y);
            let (rect, _response) = ui.allocate_exact_size(
                egui::vec2(canvas_size, canvas_size),
                egui::Sense::hover()
            );

            let painter = ui.painter();

            painter.rect_filled(rect, 0.0, egui::Color32::from_rgb(212, 212, 212));

            let cell_size = canvas_size / (self.param_size as f32);
            let gap = if self.param_size > 100 { 0.0 } else { 1.0 };

            for y in 0..self.param_size {
                for x in 0..self.param_size {
                    let agent = self.grid[y][x];
                    let color = match agent {
                        AGENT_A => egui::Color32::from_rgb(231, 76, 60), // Red
                        AGENT_B => egui::Color32::from_rgb(52, 152, 219), // Blue
                        _ => egui::Color32::WHITE, // Empty
                    };

                    let cell_rect = egui::Rect::from_min_size(
                        egui::pos2(
                            rect.min.x + (x as f32) * cell_size,
                            rect.min.y + (y as f32) * cell_size
                        ),
                        egui::vec2(cell_size - gap, cell_size - gap)
                    );

                    painter.rect_filled(cell_rect, 0.0, color);
                }
            }
        });
    }
}

fn main() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder
            ::default()
            .with_inner_size([800.0, 600.0])
            .with_min_inner_size([620.0, 420.0]),
        ..Default::default()
    };
    eframe::run_native(
        "Schelling's Model of Segregation",
        options,
        Box::new(|_cc| Box::new(SchellingApp::default()))
    )
}
